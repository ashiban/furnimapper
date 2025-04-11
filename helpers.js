/**
 * Helper functions for the Floor Planner application
 */

/**
 * Parses CSV data from a textarea using PapaParse
 * Expected format: Item, Width, Length with a header row
 *
 * @param {string} csvData - The CSV data to parse
 * @returns {Array} - Array of objects with item, width, and length properties
 */
function parseFurnitureCSV(csvData) {
    // Ensure we have data to parse
    if (!csvData || typeof csvData !== 'string' || !csvData.trim()) {
        console.error('No CSV data provided or invalid data format');
        return [];
    }

    try {
        // Parse the CSV data using PapaParse
        const parseResult = Papa.parse(csvData, {
            header: true,           // Treat first row as headers
            skipEmptyLines: true,   // Skip empty lines
            trimHeaders: true,      // Trim whitespace from headers
            transform: (value) => value.trim() // Trim all values
        });

        console.log('PapaParse result:', parseResult);

        // Check for errors
        if (parseResult.errors && parseResult.errors.length > 0) {
            console.error('PapaParse errors:', parseResult.errors);
            return [];
        }

        // Check if we have data
        if (!parseResult.data || parseResult.data.length === 0) {
            console.error('No data rows found in CSV');
            return [];
        }

        // Find the column names (case-insensitive)
        const headers = parseResult.meta.fields;
        const itemColumn = headers.find(h => h.toLowerCase().includes('item'));
        const widthColumn = headers.find(h => h.toLowerCase().includes('width'));
        const lengthColumn = headers.find(h => h.toLowerCase().includes('length'));

        // Validate that all required columns exist
        if (!itemColumn || !widthColumn || !lengthColumn) {
            console.error('CSV header must contain Item, Width, and Length columns');
            console.error('Found columns:', headers);
            return [];
        }

        // Process the data rows
        const furnitureItems = [];

        parseResult.data.forEach((row, index) => {
            // Extract values
            const item = row[itemColumn];
            const width = parseFloat(row[widthColumn]);
            const length = parseFloat(row[lengthColumn]);

            // Validate values
            if (!item) {
                console.warn(`Skipping row ${index+1}: missing item name`);
                return;
            }

            // Validate numeric values
            if (isNaN(width) || width <= 0 || isNaN(length) || length <= 0) {
                console.warn(`Skipping row ${index+1}: invalid dimensions for item "${item}"`);
                return;
            }

            // Add valid item to the result array
            furnitureItems.push({
                label: item,
                widthFeet: width,
                heightFeet: length
            });
        });

        console.log(`Successfully parsed ${furnitureItems.length} furniture items from CSV`);
        return furnitureItems;
    } catch (error) {
        console.error('Error parsing CSV data:', error);
        return [];
    }
}
