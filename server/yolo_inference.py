import cv2
import numpy as np
from ultralytics import YOLO


def process_image_yolo(image, coordinates, logging):
  try:
    model = YOLO('models/parklot_finder_27042025_640.pt')
    #logging.debug("inferencing image...")
    if image is None:
      #logging.debug("Could not load image.")
      return [], [], []
    if len(coordinates) > 0:
      # Create a mask for the ROI
      mask = np.zeros(image.shape[:2], dtype=np.uint8)
      coordinates = np.array([coordinates], dtype=np.int32)
      cv2.fillPoly(mask, coordinates, 255)

      # Extract only the ROI from the image
      x, y, w, h = cv2.boundingRect(coordinates)
      roi = image[y:y + h, x:x + w]
      mask_cropped = mask[y:y + h, x:x + w]
      roi = cv2.bitwise_and(roi, roi, mask=mask_cropped)
    else:
      roi = image
    #cv2.imwrite("before_inference.jpg", roi)
    # Run prediction
    results = model.predict(roi, conf=0.25, max_det=2000, iou=0.7)

    # Initialize counters and coordinates lists for each class
    class_counts = {0: 0, 1: 0, 2: 0}  # parking, crosswalk, handicap
    class_coordinates = {
        0: [],  # parking spots (green)
        1: [],  # crosswalks (yellow)
        2: []  # handicap spots (blue)
    }
    # Store confidence scores for each detection
    class_confidences = {
        0: [],  # confidence scores for parking spots
        1: [],  # confidence scores for crosswalks
        2: []  # confidence scores for handicap spots
    }
    #logging.debug("results: ", results)
    # Get the boxes and process each detection
    #logging.debug("results")
    for result in results:
      #logging.debug("results2")
      boxes = result.boxes
      #logging.debug("found: ", len(boxes))
      for box in boxes:
        #logging.debug("results3")
        # Get class and confidence
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])

        class_counts[class_id] += 1

        # Get the coordinates
        x1, y1, x2, y2 = box.xyxy[0]

        # Calculate center point in ROI coordinates
        center_x = int((x1 + x2) / 2)
        center_y = int((y1 + y2) / 2)

        if len(coordinates) > 0:
          # Adjust coordinates back to original image space
          adjusted_x = center_x + x
          adjusted_y = center_y + y
        else:
          adjusted_x = center_x
          adjusted_y = center_y

        # Store coordinates and confidence by class
        class_coordinates[class_id].append((adjusted_x, adjusted_y))
        class_confidences[class_id].append(confidence)
    #logging.debug("results4")
    return class_counts, class_coordinates, class_confidences
  except Exception as e:
    #logging.exception("An error occurred during image processing: %s", str(e))
    pass


def post_process2(class_counts, class_coordinates, class_confidences=None):
  '''
  Function performs the filtering of raw detections to:
  If two or more objects have centers that fall within a 5x5 pixel window,
  then:
    - If one of the objects is class 0 (parking) and any other is class 1 or 2, always remove the class 0 point.
    - If there is an area with detections from classes 0, 1, and 2, remove class 0 and, between classes 1 and 2,
      keep the one with the highest confidence (and if tied, choose class 2).

  Parameters:
  - class_counts: Dictionary with counts for each class
  - class_coordinates: Dictionary with coordinates for each class
  - class_confidences: Dictionary with confidence scores for each detection (optional)

  Returns:
  - Updated class_counts and class_coordinates
  '''
  import numpy as np
  from math import isclose
  from collections import defaultdict

  # If confidences weren't provided, assign each detection a dummy confidence of 1.0.
  if class_confidences is None:
    class_confidences = {
        cls: [1.0] * len(coords)
        for cls, coords in class_coordinates.items()
    }

  # Build a unified list of detections.
  # Each detection is a dict with keys: 'cls', 'coord', 'conf'
  detections = []
  for cls, coords in class_coordinates.items():
    confs = class_confidences.get(cls, [1.0] * len(coords))
    for coord, conf in zip(coords, confs):
      detections.append({'cls': cls, 'coord': coord, 'conf': conf})

  # We'll group detections that are "overlapping".
  # Define overlapping as: if two centers differ by at most 2 pixels in both x and y (i.e. within a 5x5 window).
  n = len(detections)
  parent = list(range(n))  # union-find structure

  def find(i):
    while parent[i] != i:
      parent[i] = parent[parent[i]]
      i = parent[i]
    return i

  def union(i, j):
    ri, rj = find(i), find(j)
    if ri != rj:
      parent[rj] = ri

  # Group detections using union-find.
  for i in range(n):
    x1, y1 = detections[i]['coord']
    for j in range(i + 1, n):
      x2, y2 = detections[j]['coord']
      if abs(x1 - x2) <= 2 and abs(y1 - y2) <= 2:
        union(i, j)

  # Build groups: key = root, value = list of indices in that group.
  groups = defaultdict(list)
  for i in range(n):
    groups[find(i)].append(i)

  # Decide which detection(s) to keep in each group.
  kept_indices = set()
  for group in groups.values():
    if len(group) == 1:
      # Only one detection in the group; keep it.
      kept_indices.add(group[0])
    else:
      # Multiple detections in the group.
      group_dets = [detections[i] for i in group]
      # Get the set of classes in this group.
      classes_in_group = set(det['cls'] for det in group_dets)
      if classes_in_group - {0}:
        # At least one non-parking detection exists.
        # Remove all class 0 detections.
        non_zero_dets = [det for det in group_dets if det['cls'] != 0]
        if non_zero_dets:
          # If more than one remains, pick the one with highest confidence.
          best_det = non_zero_dets[0]
          for det in non_zero_dets[1:]:
            if det['conf'] > best_det['conf']:
              best_det = det
            elif isclose(det['conf'], best_det['conf'], rel_tol=1e-6):
              # In a tie, prefer class 2 over class 1.
              if det['cls'] == 2 and best_det['cls'] == 1:
                best_det = det
          # Keep only the best detection from this group.
          for i in group:
            d = detections[i]
            if (d['cls'] == best_det['cls'] and d['coord'] == best_det['coord']
                and isclose(d['conf'], best_det['conf'], rel_tol=1e-6)):
              kept_indices.add(i)
              break
      else:
        # The group contains only class 0 detections.
        # According to the rule, if only class 0 exists, we do not remove them.
        for i in group:
          kept_indices.add(i)

  # Reassemble the kept detections into new dictionaries.
  new_class_coordinates = {}
  for i in kept_indices:
    d = detections[i]
    cls = d['cls']
    new_class_coordinates.setdefault(cls, []).append(d['coord'])

  new_class_counts = {
      cls: len(new_class_coordinates.get(cls, []))
      for cls in class_counts.keys()
  }

  return new_class_counts, new_class_coordinates


def post_process(class_counts, class_coordinates, class_confidences=None):
  '''
  Function performs the filtering of raw detections to:
  1. Calculate average distance between normal parking spaces (class 0)
  2. Identify and remove outlier parking spots (those that don't follow the typical pattern)
  3. For other classes, keep the detection with higher confidence when too close to parking spots

  Parameters:
  - class_counts: Dictionary with counts for each class
  - class_coordinates: Dictionary with coordinates for each class
  - class_confidences: Dictionary with confidence scores for each detection (optional)

  Returns:
  - Updated class_counts and class_coordinates
  '''
  import numpy as np
  from scipy.spatial import distance

  # If confidence scores weren't provided, create a dummy dictionary with high values
  if class_confidences is None:
    class_confidences = {
        class_id: [1.0] * len(coords)
        for class_id, coords in class_coordinates.items()
    }

  # Step 1: Calculate the average distance between normal parking spots (class 0)
  parking_spots = class_coordinates[0]

  if len(parking_spots) <= 1:
    # Not enough parking spots to calculate distances
    return class_counts, class_coordinates

  # Calculate all pairwise distances between parking spots
  all_distances = []
  for i in range(len(parking_spots)):
    for j in range(i + 1, len(parking_spots)):
      dist = distance.euclidean(parking_spots[i], parking_spots[j])
      all_distances.append(dist)

  # Calculate average distance and standard deviation
  avg_distance = sum(all_distances) / len(all_distances)
  std_distance = np.std(all_distances)
  #print(f"Average pairwise distance: {avg_distance:.2f} pixels, Std: {std_distance:.2f}")

  # For each spot, calculate its average distance to all other spots
  spot_avg_distances = []
  for i, spot in enumerate(parking_spots):
    spot_distances = []
    for j, other_spot in enumerate(parking_spots):
      if i != j:
        dist = distance.euclidean(spot, other_spot)
        spot_distances.append(dist)
    avg_dist = sum(spot_distances) / len(spot_distances)
    spot_avg_distances.append(avg_dist)

  # Identify spots with irregular distance patterns (outliers)
  # Calculate mean and std of the average distances
  mean_of_avgs = sum(spot_avg_distances) / len(spot_avg_distances)
  std_of_avgs = np.std(spot_avg_distances)

  # Define threshold for outliers (points with avg distance more than 2 std from mean)
  outlier_threshold = mean_of_avgs + 2 * std_of_avgs

  # Step 2: Filter out outlier parking spots based on their average distance to others
  filtered_parking_spots = []
  filtered_parking_confidences = []

  # Find nearest-neighbor distance for each spot (to identify the typical pattern)
  nearest_distances = []
  for i, spot in enumerate(parking_spots):
    distances_to_others = [
        distance.euclidean(spot, other)
        for j, other in enumerate(parking_spots) if i != j
    ]
    nearest_distances.append(min(distances_to_others))

  # Calculate the median nearest-neighbor distance (more robust than mean)
  median_nearest = np.median(nearest_distances)
  #print(f"Median nearest-neighbor distance: {median_nearest:.2f} pixels")

  # Define the lower threshold - distances less than 25% of the median are suspicious
  lower_threshold = 0.75 * median_nearest

  # Identify spots that are suspiciously close to others
  suspicious_pairs = []
  for i in range(len(parking_spots)):
    for j in range(i + 1, len(parking_spots)):
      dist = distance.euclidean(parking_spots[i], parking_spots[j])
      if dist < lower_threshold:
        # These spots are suspiciously close to each other
        suspicious_pairs.append((i, j))

  # For each suspicious pair, decide which one to keep based on their pattern match
  spots_to_remove = set()
  for i, j in suspicious_pairs:
    # For each spot, count how many other spots are at a reasonable distance
    # (within ±50% of the median nearest neighbor distance)
    reasonable_count_i = 0
    reasonable_count_j = 0

    for k in range(len(parking_spots)):
      if k != i and k != j:
        dist_i_k = distance.euclidean(parking_spots[i], parking_spots[k])
        dist_j_k = distance.euclidean(parking_spots[j], parking_spots[k])

        if 0.5 * median_nearest <= dist_i_k <= 1.5 * median_nearest:
          reasonable_count_i += 1

        if 0.5 * median_nearest <= dist_j_k <= 1.5 * median_nearest:
          reasonable_count_j += 1

    # Keep the spot that has more connections at reasonable distances
    if reasonable_count_i >= reasonable_count_j:
      spots_to_remove.add(j)
    else:
      spots_to_remove.add(i)

  # Build the filtered list of parking spots
  for i, (spot, conf) in enumerate(zip(parking_spots, class_confidences[0])):
    if i not in spots_to_remove:
      filtered_parking_spots.append(spot)
      filtered_parking_confidences.append(conf)

  # Update class coordinates and count for parking spots
  class_coordinates[0] = filtered_parking_spots
  class_confidences[0] = filtered_parking_confidences
  class_counts[0] = len(filtered_parking_spots)

  # Step 3: Process other classes (crosswalks and handicap spots)
  # Use 50% of the median nearest-neighbor distance as threshold
  threshold_other_class = 0.5 * median_nearest

  for class_id in [1, 2]:  # Process crosswalks and handicap spots
    spots = class_coordinates[class_id]
    confs = class_confidences[class_id]

    # Create a copy of the lists to allow for removal during iteration
    new_spots = []
    new_confs = []
    spots_to_remove_other = set()

    # Check each spot from this class against parking spots
    for i, spot in enumerate(spots):
      for j, parking_spot in enumerate(filtered_parking_spots):
        dist = distance.euclidean(spot, parking_spot)

        if dist < threshold_other_class:
          # They're too close - decide which to keep based on confidence
          if confs[i] <= filtered_parking_confidences[j]:
            # Remove this spot (lower confidence)
            spots_to_remove_other.add(i)
          else:
            # Keep this spot, remove the parking spot (higher confidence)
            spots_to_remove.add(j)

    # Keep only the spots that weren't marked for removal
    for i, (spot, conf) in enumerate(zip(spots, confs)):
      if i not in spots_to_remove_other:
        new_spots.append(spot)
        new_confs.append(conf)

    # Update class coordinates, confidences and count
    class_coordinates[class_id] = new_spots
    class_confidences[class_id] = new_confs
    class_counts[class_id] = len(new_spots)

  # Final update: if any parking spots were marked for removal in the last step, remove them
  if spots_to_remove:
    new_parking_spots = []
    new_parking_confs = []

    for i, (spot, conf) in enumerate(
        zip(filtered_parking_spots, filtered_parking_confidences)):
      if i not in spots_to_remove:
        new_parking_spots.append(spot)
        new_parking_confs.append(conf)

    class_coordinates[0] = new_parking_spots
    class_confidences[0] = new_parking_confs
    class_counts[0] = len(new_parking_spots)

  return class_counts, class_coordinates


'''
# Main execution
if __name__ == "__main__":
    image_path = "samples/back1.jpg"

    # Process the image with YOLO
    class_counts, class_coordinates, class_confidences = process_image_yolo(image_path, [])

    # Print original detection counts
    print("Original detection counts:")
    for class_id, count in class_counts.items():
        print(f"Class {class_id}: {count} detections")

    # Apply post-processing
    class_counts, class_coordinates = post_process(class_counts, class_coordinates, class_confidences)

    # Print filtered detection counts
    print("\nAfter post-processing:")
    for class_id, count in class_counts.items():
        print(f"Class {class_id}: {count} detections")

    # Draw the detected points on the image
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Could not load image.")

    # Define colors for each class (in BGR format)
    colors = {
        0: (0, 255, 0),  # Green for parking spots
        1: (0, 255, 255),  # Yellow for crosswalks
        2: (255, 0, 0)  # Blue for handicap spots
    }

    # Draw the detected points on the image with different colors by class
    for class_id, coordinates in class_coordinates.items():
        for (cx, cy) in coordinates:
            cv2.circle(image, (cx, cy), 5, colors[class_id], -1)

    # Save the processed image with all points
    output_filename = 'processed_out.jpg'
    cv2.imwrite(output_filename, image)
    print(f"\nProcessed image saved as {output_filename}")
'''
