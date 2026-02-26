/**
 * Function to filter object key-value pairs based on a substring in the key
 * @param {Object} obj - The object to filter
 * @param {string} substring - The substring to search for in the keys
 * @return {Array} - An array of key-value pairs where the key contains the substring
 */
export function filterObjectByKeySubstring(obj, substring) {
    // Create an array to store the matching key-value pairs
    const result = [];

    // Iterate over the object keys
    for (const key in obj) {
        // Check if the key contains the specified substring
        if (obj.hasOwnProperty(key) && key.includes(substring)) {
            // Push the key-value pair as an array to the result array
            result.push([key, obj[key]]);
        }
    }

    // Return the result array
    return result;
}

/**
 * Function to get the top N items based on the second item of the subarray
 * and strip the '_perc' suffix from the keys
 * @param {Array} arr - The array of arrays to process
 * @param {number} n - Number of top items to return (default 5)
 * @return {Array} - An array with the top N items
 */
export function getTopFive(arr, n = 5) {
    // Sort the array based on the second item of the subarrays in descending order
    arr.sort((a, b) => b[1] - a[1]);

    // Get the top N items
    const topN = arr.slice(0, n);

    // Strip the '_perc' suffix from the keys
    return topN.map(([key, value]) => [key.replace('_perc', ''), value]);
}

export function percentageOfMaxArray(arr) {
    // Step 1: Find the maximum value in the array
    const max = Math.max(...arr);

    // Step 2: Calculate the percentage of the maximum for each value in the array
    const percentageArray = arr.map(value => (value / max) * 100);

    return percentageArray;
}


export function convertHoursData(startTimes, endTimes) {
  const dayMap = {
    mon: 'Mo',
    tue: 'Tu',
    wed: 'We',
    thu: 'Th',
    fri: 'Fr',
    sat: 'Sa',
    sun: 'Su'
  };

  // Define the correct day order (Monday to Sunday)
  const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  // Convert arrays to objects for easy lookup
  const startObj = Object.fromEntries(startTimes);
  const endObj = Object.fromEntries(endTimes);

  // Build result in the correct order
  let result = dayOrder.map(dayPrefix => {
    const startKey = `${dayPrefix}_start`;
    const endKey = `${dayPrefix}_end`;

    const day = dayMap[dayPrefix];
    const startTime = startObj[startKey];
    const endTime = endObj[endKey];

    let openTime, closeTime, closed;

    if (!startTime || !endTime || endTime === "NA") {
      openTime = '';
      closeTime = '';
      closed = true;
    } else {
      openTime = startTime.split(':')[0];
      closeTime = endTime.split(':')[0];
      closed = false;
    }

    return {
      day: day,
      open: openTime,
      close: closeTime,
      closed: closed
    };
  });

  return result;
}
