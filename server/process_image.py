import cv2
import numpy as np
import base64
from PIL import Image
import io
import sys
import json
import logging
import os
from datetime import datetime
from yolo_inference import process_image_yolo, post_process, post_process2
import uuid


def process_screenshot(base64_image, polygon_coordinates=None):
    try:
        # Generate a unique ID for this processing request
        unique_id = str(uuid.uuid4())

        # Decode base64 image
        image_data = base64_image.split(',')[1]
        decoded_data = base64.b64decode(image_data)

        # Convert to numpy array
        nparr = np.frombuffer(decoded_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            error_result = {
                'error': 'could not load image for processing',
                'status': 'error'
            }
            print(json.dumps(error_result), file=sys.stdout)
            return error_result

        # Ensure directories exist
        os.makedirs('tmp/original', exist_ok=True)
        os.makedirs('tmp/processed', exist_ok=True)

        # Save original image
        output_filename = f'tmp/original/{unique_id}.jpg'
        cv2.imwrite(output_filename, image)
        height, width = image.shape[:2]

        class_coordinates_final = {}
        polygon_results = []  # List to store per-polygon results

        if polygon_coordinates:
            for polygon_index, polygon in enumerate(polygon_coordinates):
                polygon_points = [(int(point['x']), int(point['y']))
                                  for point in polygon]

                # Redirect YOLO output to stderr
                old_stdout = sys.stdout
                sys.stdout = sys.stderr
                try:
                    class_counts, class_coordinates, class_confidences = process_image_yolo(
                        image, polygon_points, logging)
                finally:
                    sys.stdout = old_stdout

                class_counts, class_coordinates = post_process2(
                    class_counts, class_coordinates, class_confidences)

                # Store per-polygon counts
                polygon_result = {
                    'polygon_index': polygon_index,
                    'parking': len(class_coordinates.get(0, [])),
                    'crosswalks': len(class_coordinates.get(1, [])),
                    'handicap': len(class_coordinates.get(2, []))
                }
                polygon_results.append(polygon_result)

                for class_id, coords in class_coordinates.items():
                    if class_id not in class_coordinates_final:
                        class_coordinates_final[class_id] = []
                    class_coordinates_final[class_id].extend(coords)
        else:
            # Redirect YOLO output to stderr
            old_stdout = sys.stdout
            sys.stdout = sys.stderr
            try:
                class_counts, class_coordinates, class_confidences = process_image_yolo(
                    image, [], logging)
            finally:
                sys.stdout = old_stdout

            class_counts, class_coordinates = post_process2(
                class_counts, class_coordinates, class_confidences)
            class_coordinates_final = class_coordinates

        # Draw detected points
        colors = {
            0: (0, 255, 0),  # Green for parking spots
            1: (0, 255, 255),  # Yellow for crosswalks
            2: (255, 0, 0)  # Blue for handicap spots
        }
        '''
        for class_id, coordinates in class_coordinates_final.items():
            for (cx, cy) in coordinates:
                cv2.circle(image, (cx, cy), 5, colors[class_id], -1)
        '''
        # Save processed image
        output_filename = f'tmp/processed/{unique_id}.jpg'
        cv2.imwrite(output_filename, image)

        # Calculate total counts per class based on the final coordinates
        total_parking = len(class_coordinates_final.get(0, []))
        total_crosswalks = len(class_coordinates_final.get(1, []))
        total_handicap = len(class_coordinates_final.get(2, []))

        # Prepare result
        result = {
            'width':
            width,
            'height':
            height,
            'status':
            'success',
            'polygons_processed':
            len(polygon_coordinates) if polygon_coordinates else 0,
            'total_counts':
            0,  # original key, can be kept or removed if desired
            'total_parking':
            total_parking,
            'total_crosswalks':
            total_crosswalks,
            'total_handicap':
            total_handicap,
            'image_path':
            output_filename,
            'unique_id':
            unique_id,
            'polygon_counts':
            polygon_results,  # Add the per-polygon counts
            'detected_points': {
                'parking': class_coordinates_final.get(0, []),
                'crosswalks': class_coordinates_final.get(1, []),
                'handicap': class_coordinates_final.get(2, [])
            }
        }

        # Print only the JSON result to stdout
        print(json.dumps(result), file=sys.stdout)
        return result

    except Exception as e:
        error_result = {'error': str(e), 'status': 'error'}
        print(json.dumps(error_result), file=sys.stdout)
        return error_result


if __name__ == "__main__":
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        data = json.loads(input_data)

        image_data = data.get('image')
        polygon_coordinates = data.get('polygonCoordinates', [])

        if not image_data:
            error_result = {
                'error': "No image data received",
                'status': 'error'
            }
            print(json.dumps(error_result), file=sys.stdout)
        else:
            process_screenshot(image_data, polygon_coordinates)

    except Exception as e:
        error_result = {'error': str(e), 'status': 'error'}
        print(json.dumps(error_result), file=sys.stdout)
