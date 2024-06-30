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
 * Function to get the top five items based on the second item of the subarray
 * and strip the '_perc' suffix from the keys
 * @param {Array} arr - The array of arrays to process
 * @return {Array} - An array with the top five items
 */
export function getTopFive(arr) {
    // Sort the array based on the second item of the subarrays in descending order
    arr.sort((a, b) => b[1] - a[1]);

    // Get the top five items
    const topFive = arr.slice(0, 5);

    // Strip the '_perc' suffix from the keys
    return topFive.map(([key, value]) => [key.replace('_perc', ''), value]);
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

  let result = [];

  for (let i = 0; i < startTimes.length; i++) {
    let dayPrefix = startTimes[i][0].split('_')[0];
    let day = dayMap[dayPrefix];
    let openTime = startTimes[i][1].split(':')[0];
    let endTime = endTimes[i][1];

    let closeTime, closed;
    if (endTime === "NA") {
      closeTime = '';
      closed = true;
    } else {
      closeTime = endTime.split(':')[0];
      closed = false;
    }

    result.push({
      day: day,
      open: openTime,
      close: closeTime,
      closed: closed
    });
  }

  return result;
}
