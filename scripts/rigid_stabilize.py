#!/usr/bin/env python3

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
LOCAL_PYTHON_PACKAGES = REPO_ROOT / ".python-packages"

if LOCAL_PYTHON_PACKAGES.exists():
    sys.path.insert(0, str(LOCAL_PYTHON_PACKAGES))

import cv2  # type: ignore
import numpy as np  # type: ignore


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rigid video stabilization using translation + rotation only.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--width", type=int, default=0)
    parser.add_argument("--analysis-width", type=int, default=320)
    parser.add_argument("--smooth-radius", type=int, default=6)
    parser.add_argument("--max-corners", type=int, default=400)
    parser.add_argument("--quality-level", type=float, default=0.01)
    parser.add_argument("--min-distance", type=float, default=30.0)
    parser.add_argument("--max-shift-ratio", type=float, default=0.015)
    parser.add_argument("--max-rotation-deg", type=float, default=1.5)
    parser.add_argument("--ecc-threshold", type=float, default=0.85)
    return parser.parse_args()


def resize_frame(frame: np.ndarray, width: int) -> np.ndarray:
    if width <= 0:
        return frame

    height, current_width = frame.shape[:2]

    if current_width == width:
        return frame

    scale = width / current_width
    target_height = max(2, int(round(height * scale / 2) * 2))
    return cv2.resize(frame, (width, target_height), interpolation=cv2.INTER_AREA)


def preprocess_gray(gray: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    normalized = cv2.normalize(blurred, None, 0, 255, cv2.NORM_MINMAX)
    return normalized.astype(np.float32) / 255.0


def build_registration_mask(previous_gray: np.ndarray, current_gray: np.ndarray) -> np.ndarray | None:
    previous_blurred = cv2.GaussianBlur(previous_gray, (5, 5), 0)
    current_blurred = cv2.GaussianBlur(current_gray, (5, 5), 0)
    previous_threshold = max(16.0, float(np.percentile(previous_blurred, 52)))
    current_threshold = max(16.0, float(np.percentile(current_blurred, 52)))
    previous_mask = previous_blurred >= previous_threshold
    current_mask = current_blurred >= current_threshold
    combined_mask = np.logical_and(previous_mask, current_mask).astype(np.uint8) * 255

    if np.count_nonzero(combined_mask) < previous_gray.size * 0.12:
        combined_mask = np.logical_or(previous_mask, current_mask).astype(np.uint8) * 255

    if np.count_nonzero(combined_mask) < previous_gray.size * 0.08:
        return None

    combined_mask = cv2.morphologyEx(
        combined_mask,
        cv2.MORPH_CLOSE,
        np.ones((5, 5), dtype=np.uint8)
    )
    combined_mask = cv2.erode(combined_mask, np.ones((3, 3), dtype=np.uint8), iterations=1)
    return combined_mask


def to_homogeneous(matrix: np.ndarray) -> np.ndarray:
    return np.vstack([matrix.astype(np.float64), np.array([0.0, 0.0, 1.0], dtype=np.float64)])


def params_from_matrix(matrix: np.ndarray) -> np.ndarray:
    cos_a = float(matrix[0, 0])
    sin_a = float(matrix[1, 0])
    angle = math.atan2(sin_a, cos_a)
    return np.array([float(matrix[0, 2]), float(matrix[1, 2]), angle], dtype=np.float64)


def matrix_from_params(dx: float, dy: float, angle: float) -> np.ndarray:
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    return np.array([
        [cos_a, -sin_a, dx],
        [sin_a, cos_a, dy],
        [0.0, 0.0, 1.0]
    ], dtype=np.float64)


def scale_params(params: np.ndarray, x_scale: float, y_scale: float) -> np.ndarray:
    if len(params) == 0:
        return params

    scaled = np.copy(params)
    scaled[:, 0] *= x_scale
    scaled[:, 1] *= y_scale
    return scaled


def moving_average(curve: np.ndarray, radius: int) -> np.ndarray:
    if radius <= 0:
        return curve.copy()

    window_size = radius * 2 + 1
    filter_kernel = np.ones(window_size, dtype=np.float64) / window_size
    padded = np.pad(curve, (radius, radius), mode="edge")
    smoothed = np.convolve(padded, filter_kernel, mode="same")
    return smoothed[radius:-radius]


def smooth_trajectory(trajectory: np.ndarray, radius: int) -> np.ndarray:
    smoothed = np.copy(trajectory)

    for column in range(trajectory.shape[1]):
        smoothed[:, column] = moving_average(trajectory[:, column], radius)

    return smoothed


def estimate_transform_ecc(
    previous_gray: np.ndarray,
    current_gray: np.ndarray,
    ecc_threshold: float,
    mask: np.ndarray | None
) -> np.ndarray | None:
    warp = np.eye(2, 3, dtype=np.float32)
    criteria = (
        cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT,
        80,
        1e-6
    )

    try:
        correlation, warp = cv2.findTransformECC(
            preprocess_gray(previous_gray),
            preprocess_gray(current_gray),
            warp,
            cv2.MOTION_EUCLIDEAN,
            criteria,
            mask,
            3
        )
    except cv2.error:
        return None

    if not math.isfinite(float(correlation)) or float(correlation) < ecc_threshold:
        return None

    return to_homogeneous(warp)


def estimate_transform_flow(
    previous_gray: np.ndarray,
    current_gray: np.ndarray,
    max_corners: int,
    quality_level: float,
    min_distance: float,
    mask: np.ndarray | None
) -> np.ndarray | None:
    previous_points = cv2.goodFeaturesToTrack(
        previous_gray,
        maxCorners=max_corners,
        qualityLevel=quality_level,
        minDistance=min_distance,
        blockSize=3,
        mask=mask
    )

    if previous_points is None or len(previous_points) < 8:
        return None

    current_points, status, _ = cv2.calcOpticalFlowPyrLK(previous_gray, current_gray, previous_points, None)

    if current_points is None or status is None:
        return None

    valid_previous = previous_points[status.flatten() == 1]
    valid_current = current_points[status.flatten() == 1]

    if len(valid_previous) < 8 or len(valid_current) < 8:
        return None

    matrix, _ = cv2.estimateAffinePartial2D(
        valid_previous,
        valid_current,
        method=cv2.RANSAC,
        ransacReprojThreshold=3.0,
        maxIters=2000,
        confidence=0.99
    )

    if matrix is None:
        return None

    dx, dy, angle = params_from_matrix(to_homogeneous(matrix))
    return matrix_from_params(dx, dy, angle)


def estimate_transforms(
    capture: cv2.VideoCapture,
    analysis_width: int,
    max_corners: int,
    quality_level: float,
    min_distance: float,
    ecc_threshold: float
) -> tuple[list[np.ndarray], float, tuple[int, int], tuple[int, int]]:
    fps = capture.get(cv2.CAP_PROP_FPS) or 24.0
    ok, previous_frame = capture.read()

    if not ok:
        raise RuntimeError("Unable to read first frame from video.")

    source_height, source_width = previous_frame.shape[:2]
    previous_frame = resize_frame(previous_frame, analysis_width)
    analysis_height, analysis_width = previous_frame.shape[:2]
    previous_gray = cv2.cvtColor(previous_frame, cv2.COLOR_BGR2GRAY)
    transforms: list[np.ndarray] = []

    while True:
        ok, current_frame = capture.read()

        if not ok:
            break

        current_frame = resize_frame(current_frame, analysis_width)
        current_gray = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)
        registration_mask = build_registration_mask(previous_gray, current_gray)
        matrix = estimate_transform_ecc(previous_gray, current_gray, ecc_threshold, registration_mask)

        if matrix is None:
            matrix = estimate_transform_flow(
                previous_gray,
                current_gray,
                max_corners,
                quality_level,
                min_distance,
                registration_mask
            )

        transforms.append(matrix if matrix is not None else np.eye(3, dtype=np.float64))
        previous_gray = current_gray

    return transforms, fps, (analysis_width, analysis_height), (source_width, source_height)


def repair_delta_params(
    delta_params: np.ndarray,
    width: int,
    height: int,
    max_shift_ratio: float,
    max_rotation_deg: float
) -> np.ndarray:
    if len(delta_params) == 0:
        return delta_params

    repaired = np.copy(delta_params)
    max_dx = max(2.0, width * max_shift_ratio)
    max_dy = max(2.0, height * max_shift_ratio)
    max_angle = math.radians(max_rotation_deg)
    valid = (
        np.isfinite(repaired[:, 0]) &
        np.isfinite(repaired[:, 1]) &
        np.isfinite(repaired[:, 2]) &
        (np.abs(repaired[:, 0]) <= max_dx) &
        (np.abs(repaired[:, 1]) <= max_dy) &
        (np.abs(repaired[:, 2]) <= max_angle)
    )

    if not np.any(valid):
        return np.zeros_like(repaired)

    indices = np.arange(len(repaired))

    for column in range(repaired.shape[1]):
        repaired[~valid, column] = np.interp(indices[~valid], indices[valid], repaired[valid, column])

    repaired[:, 0] = np.clip(repaired[:, 0], -max_dx, max_dx)
    repaired[:, 1] = np.clip(repaired[:, 1], -max_dy, max_dy)
    repaired[:, 2] = np.clip(repaired[:, 2], -max_angle, max_angle)
    return repaired


def build_absolute_transforms(delta_transforms: list[np.ndarray]) -> list[np.ndarray]:
    transforms = [np.eye(3, dtype=np.float64)]

    for delta in delta_transforms:
        transforms.append(transforms[-1] @ delta)

    return transforms


def smooth_absolute_transforms(absolute_transforms: list[np.ndarray], radius: int) -> list[np.ndarray]:
    params = np.array([params_from_matrix(matrix) for matrix in absolute_transforms], dtype=np.float64)
    params[:, 2] = np.unwrap(params[:, 2])
    smoothed = smooth_trajectory(params, radius)
    return [matrix_from_params(dx, dy, angle) for dx, dy, angle in smoothed]


def write_stabilized_video(
    input_path: Path,
    output_path: Path,
    delta_transforms: list[np.ndarray],
    fps: float,
    analysis_size: tuple[int, int],
    source_size: tuple[int, int],
    smooth_radius: int,
    target_width: int,
    max_shift_ratio: float,
    max_rotation_deg: float
) -> None:
    analysis_width, analysis_height = analysis_size
    source_width, source_height = source_size
    output_width = target_width if target_width > 0 else source_width
    output_height = source_height if target_width <= 0 else resize_frame(
        np.zeros((source_height, source_width, 3), dtype=np.uint8),
        target_width
    ).shape[0]
    delta_params = np.array([params_from_matrix(matrix) for matrix in delta_transforms], dtype=np.float64)
    repaired_params = repair_delta_params(
        delta_params,
        analysis_width,
        analysis_height,
        max_shift_ratio,
        max_rotation_deg
    )
    repaired_params = scale_params(
        repaired_params,
        output_width / analysis_width,
        output_height / analysis_height
    )
    repaired_transforms = [matrix_from_params(dx, dy, angle) for dx, dy, angle in repaired_params]
    absolute_transforms = build_absolute_transforms(repaired_transforms)
    smoothed_absolute_transforms = smooth_absolute_transforms(absolute_transforms, smooth_radius)

    capture = cv2.VideoCapture(str(input_path))
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_path), fourcc, fps, (output_width, output_height))

    if not writer.isOpened():
        raise RuntimeError("Unable to open output video writer.")

    ok, frame = capture.read()

    if not ok:
        raise RuntimeError("Unable to read frames for stabilization output.")

    frame_index = 0

    while ok and frame_index < len(absolute_transforms):
        frame = resize_frame(frame, output_width)
        correction_matrix = absolute_transforms[frame_index] @ np.linalg.inv(smoothed_absolute_transforms[frame_index])
        stabilized = cv2.warpAffine(
            frame,
            correction_matrix[:2].astype(np.float32),
            (output_width, output_height),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REPLICATE
        )
        writer.write(stabilized)
        frame_index += 1
        ok, frame = capture.read()

    writer.release()
    capture.release()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    capture = cv2.VideoCapture(str(input_path))

    if not capture.isOpened():
        raise RuntimeError(f"Unable to open input video: {input_path}")

    analysis_width = args.analysis_width if args.analysis_width > 0 else args.width
    transforms, fps, analysis_size, source_size = estimate_transforms(
        capture,
        analysis_width,
        args.max_corners,
        args.quality_level,
        args.min_distance,
        args.ecc_threshold
    )
    capture.release()

    write_stabilized_video(
        input_path,
        output_path,
        transforms,
        fps,
        analysis_size,
        source_size,
        max(1, args.smooth_radius),
        args.width,
        args.max_shift_ratio,
        args.max_rotation_deg
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
