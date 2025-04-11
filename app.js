const width = 800;
const height = 600;

// Initialize Konva Stage and Layers
const stage = new Konva.Stage({
    container: 'canvas-container',
    width: width,
    height: height,
});

// Create separate layers for background image and drawing elements
const backgroundLayer = new Konva.Layer(); // Layer for the background image
const layer = new Konva.Layer(); // Layer for grid and furniture

// Add layers to stage in the correct order (background first)
stage.add(backgroundLayer);
stage.add(layer);

// Data structure to store all objects (rectangles, etc.)
let objects = [];

// State variables for object selection and rotation
let selectedObjectIndex = -1; // Index of the currently selected object (-1 means none)
const rotationIncrement = 30; // Rotation increment in degrees

// State variable for showing dimensions
let showDimensions = false; // Default to not showing dimensions

// Make sure the toggle checkboxes match our default states
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('show-dimensions-toggle').checked = showDimensions;
});

// State variables for scale definition
let isScaleDefinitionMode = false; // Flag to track if we're in scale definition mode
let scaleStartPoint = null; // Starting point of the scale line
let scaleEndPoint = null; // Ending point of the scale line
let scalePixelsPerFoot = null; // Calculated scale (pixels per foot)
let scaleLine = null; // Reference to the scale line object

// Create temporary line for scale definition
let tempScaleLine = new Konva.Line({
    points: [],
    stroke: '#FF5722', // Orange color for scale line
    strokeWidth: 3,
    dash: [10, 5], // Dashed line for visual distinction
});
layer.add(tempScaleLine);

// Rectangle modal elements
const rectangleModal = document.getElementById('rectangle-modal');
const rectangleWidthInput = document.getElementById('rectangle-width');
const rectangleHeightInput = document.getElementById('rectangle-height');
const rectangleLabelInput = document.getElementById('rectangle-label');
const addRectangleConfirmBtn = document.getElementById('add-rectangle-confirm-btn');
const cancelRectangleBtn = document.getElementById('cancel-rectangle-btn');

// Handle mouse clicks on stage
stage.on('click', (e) => {
    // Get the clicked target
    const clickedTarget = e.target;

    // Check if we clicked on a rectangle (prioritize rectangle selection)
    const clickedOnRect = clickedTarget instanceof Konva.Rect;
    const clickedOnText = clickedTarget instanceof Konva.Text;

    // If we clicked on a rectangle or its text, don't proceed further
    // The rectangle's own click handler will handle selection
    if (clickedOnRect || clickedOnText) {
        return;
    }

    // If we clicked on the stage (not on any object), deselect any selected object
    if (clickedTarget === stage) {
        deselectObject();
    }
});

// Generate a random color with specified opacity
function getRandomColor(opacity = 1) {
    const r = Math.floor(Math.random() * 200);
    const g = Math.floor(Math.random() * 200);
    const b = Math.floor(Math.random() * 200);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Function to draw grid lines
function drawGrid() {
    const gridSize = 20;

    // Draw vertical lines
    for (let i = 0; i <= width; i += gridSize) {
        const verticalLine = new Konva.Line({
            points: [i, 0, i, height],
            stroke: '#ccc',
            strokeWidth: 0.5,
        });
        layer.add(verticalLine);
    }

    // Draw horizontal lines
    for (let i = 0; i <= height; i += gridSize) {
        const horizontalLine = new Konva.Line({
            points: [0, i, width, i],
            stroke: '#ccc',
            strokeWidth: 0.5,
        });
        layer.add(horizontalLine);
    }

    layer.batchDraw();
}

// Draw initial grid lines
drawGrid();

// Image upload functionality
const imageUploadInput = document.getElementById('image-upload');
let backgroundImage = null;

// Handle image upload
imageUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Only process image files
    if (!file.type.match('image.*')) {
        alert('Please select an image file');
        return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Remove any existing background image
            if (backgroundImage) {
                backgroundImage.destroy();
            }

            // Create new Konva image
            backgroundImage = new Konva.Image({
                x: 0,
                y: 0,
                image: img,
                width: width,  // Scale to canvas width
                height: height, // Scale to canvas height
                listening: false, // Don't capture events on the image
            });

            // Add the image to the background layer
            backgroundLayer.add(backgroundImage);

            // Move the image to the bottom of the layer
            backgroundImage.moveToBottom();

            // Redraw the background layer
            backgroundLayer.batchDraw();
        };
        img.src = event.target.result;
    };

    // Read the image file as a data URL
    reader.readAsDataURL(file);
});

// Export Floor Grid functionality
function exportFloorGrid() {
    // Check if we have any objects to export
    if (objects.length === 0) {
        alert('No furniture to export. Add at least one piece of furniture first.');
        return;
    }

    // Create a data structure for export
    let exportData = {
        scale_pixels_per_foot: scalePixelsPerFoot,
        objects: objects.map(obj => ({
            type: obj.type,
            label: obj.label,
            width_feet: obj.width_feet,
            height_feet: obj.height_feet,
            x_pixels: obj.x_pixels,
            y_pixels: obj.y_pixels,
            rotation_degrees: obj.rotation_degrees || 0 // Include rotation in export
        }))
    };

    console.log('Exporting data:', exportData);
    console.log(`Exporting ${objects.length} objects`);

    // Convert to JSON string with pretty formatting
    const jsonString = JSON.stringify(exportData, null, 2);

    // Create a blob with the JSON data
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Create a URL for the blob
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floor_grid.json';

    // Append to the document, click it, and remove it
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up by revoking the URL
    URL.revokeObjectURL(url);
}

// Export button handler
const exportBtn = document.getElementById('export-btn');
exportBtn.addEventListener('click', exportFloorGrid);

// Function to update export button state
function updateExportButtonState() {
    // Enable export button if there are any objects
    exportBtn.disabled = (objects.length === 0);
}

// Import Floor Grid functionality
function importFloorGrid(file) {
    if (!file) return;

    // Only process JSON files
    if (file.type !== 'application/json') {
        alert('Please select a JSON file');
        return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            console.log('Starting import process...');
            // Parse the JSON data
            const importedData = JSON.parse(event.target.result);
            console.log('Parsed JSON data:', importedData);

            // Clear existing objects
            console.log('Clearing existing objects...');
            clearAllObjects();
            console.log('Cleared existing objects');

            // Ensure objects array is initialized
            if (!objects || !Array.isArray(objects)) {
                console.log('Objects array was not properly initialized, creating new array');
                objects = [];
            }

            // Check if the imported data is in the expected format
            if (importedData && typeof importedData === 'object' && !Array.isArray(importedData)) {
                // Format with scale
                console.log('Detected JSON with scale');

                // Ensure objects array exists
                if (!importedData.objects) {
                    console.log('No objects array found in imported data, adding empty array');
                    importedData.objects = [];
                }

                // Extract and set the scale if available
                if (typeof importedData.scale_pixels_per_foot === 'number') {
                    scalePixelsPerFoot = importedData.scale_pixels_per_foot;
                    // Update the scale button text
                    updateScaleButtonText();
                    console.log(`Imported scale: ${scalePixelsPerFoot.toFixed(2)} pixels per foot`);
                } else if (typeof importedData.scale_pixels_per_inch === 'number') {
                    // Handle legacy format (inches)
                    scalePixelsPerFoot = importedData.scale_pixels_per_inch * 12; // Convert inches to feet (12 inches = 1 foot)
                    updateScaleButtonText();
                    console.log(`Converted legacy scale from inches to feet: ${scalePixelsPerFoot.toFixed(2)} pixels per foot`);
                } else {
                    // If scale is not defined in the JSON but objects exist, warn the user
                    if (importedData.objects && importedData.objects.length > 0) {
                        console.warn('Warning: Scale is not defined in the imported data but objects exist.');
                        const defineScale = confirm('The imported file contains objects but no scale definition. Objects need a scale to be displayed correctly. Would you like to define a scale now?');

                        if (defineScale) {
                            // Exit the import process and let the user define a scale
                            toggleScaleDefinitionMode();
                            alert('Please define a scale by drawing a line and specifying its real-world length. Then import the file again.');
                            return;
                        } else {
                            // If user doesn't want to define scale, use a default value
                            scalePixelsPerFoot = 120; // Default value: 120 pixels per foot (10 pixels per inch * 12)
                            updateScaleButtonText();
                            console.log(`Using default scale: ${scalePixelsPerFoot.toFixed(2)} pixels per foot`);
                            alert('Using default scale of 120 pixels per foot. Objects may not be displayed at the correct size.');
                        }
                    }
                }

                // Process objects if available
                if (importedData.objects && Array.isArray(importedData.objects)) {
                    console.log(`Processing ${importedData.objects.length} objects from imported data`);

                    // Check if scale is defined before processing objects
                    if (scalePixelsPerFoot === null) {
                        console.error('Scale is not defined. Cannot create objects with proper dimensions.');
                        alert('Scale is not defined. Please define a scale using the "Define Scale" button before importing objects.');
                        return;
                    }

                    // Track successfully created objects
                    let successCount = 0;

                    importedData.objects.forEach((item, index) => {
                        console.log(`Processing object ${index + 1}:`, item);
                        // Validate required fields
                        if (!item.type || !item.label || typeof item.x_pixels !== 'number' || typeof item.y_pixels !== 'number') {
                            console.error('Invalid object data:', item);
                            throw new Error('Invalid object data: Missing required properties');
                        }

                        // Check for dimensions in either feet or inches format
                        if (!((typeof item.width_feet === 'number' && typeof item.height_feet === 'number') ||
                              (typeof item.width_inches === 'number' && typeof item.height_inches === 'number'))) {
                            console.error('Invalid object data: Missing dimensions in either feet or inches:', item);
                            throw new Error('Invalid object data: Missing dimensions');
                        }

                        // Create a new object from the imported data
                        const success = createObjectFromData(item);
                        if (success) {
                            successCount++;
                            console.log(`Successfully created object ${index + 1}: ${item.label}`);
                        } else {
                            console.warn(`Failed to create object ${index + 1}: ${item.label}`);
                        }
                    });

                    console.log(`Finished processing ${importedData.objects.length} objects. Successfully created ${successCount} objects.`);

                    // If no objects were created successfully but there were objects in the data, show a warning
                    if (successCount === 0 && importedData.objects.length > 0) {
                        console.warn('Warning: Failed to create any objects from the imported data');
                        alert('Failed to create any objects from the imported data. Please check the console for details.');
                    }
                } else {
                    console.log('No objects array found in imported data or it is empty');
                }

                // Update the export button state
                updateExportButtonState();

                // Show success message with object count
                const objectCount = importedData.objects ? importedData.objects.length : 0;
                console.log(`Imported ${objectCount} objects`);
            } else {
                // Handle legacy format or invalid format
                if (Array.isArray(importedData)) {
                    // This is the old format with just polygons - we don't support this anymore
                    throw new Error('Legacy polygon-only format is no longer supported');
                } else {
                    throw new Error('Invalid JSON format: Expected an object with objects property');
                }
            }
        } catch (error) {
            console.error('Error importing floor grid:', error);
            alert(`Error importing floor grid: ${error.message}`);
            // Reset to default message on error
            importFileName.textContent = 'Furniture not loaded';
        }
    };

    reader.onerror = () => {
        alert('Error reading the file');
        // Reset to default message on error
        importFileName.textContent = 'Furniture not loaded';
    };

    // Read the file as text
    reader.readAsText(file);

    // Display the file name
    document.getElementById('import-file-name').textContent = file.name;
}

// Import button and file input handlers
const importBtn = document.getElementById('import-btn');
const jsonUploadInput = document.getElementById('json-upload');
const importFileName = document.getElementById('import-file-name');

// Initialize with default message
// importFileName.textContent = 'Furniture not loaded'; // Already set in HTML

// Click on import button triggers file input
importBtn.addEventListener('click', () => {
    jsonUploadInput.click();
});

// Handle file selection
jsonUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        importFloorGrid(file);
    } else {
        // Reset to default message if no file selected
        importFileName.textContent = 'Furniture not loaded';
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
});

// Add stage event handler to prevent default context menu on stage
stage.on('contextmenu', (e) => {
    e.evt.preventDefault();
});

// Scale Definition Button Handler
const defineScaleBtn = document.getElementById('define-scale-btn');
defineScaleBtn.addEventListener('click', toggleScaleDefinitionMode);

// Function to toggle scale definition mode
function toggleScaleDefinitionMode() {
    // If we're already in scale definition mode, exit it
    if (isScaleDefinitionMode) {
        exitScaleDefinitionMode();
        return;
    }

    // Enter scale definition mode
    isScaleDefinitionMode = true;

    // Update button appearance
    defineScaleBtn.classList.add('active');
    defineScaleBtn.textContent = 'Cancel Scale Definition';

    // Reset scale points
    scaleStartPoint = null;
    scaleEndPoint = null;

    // Clear any existing temporary scale line
    tempScaleLine.points([]);
    layer.batchDraw();
}

// Function to exit scale definition mode
function exitScaleDefinitionMode() {
    isScaleDefinitionMode = false;

    // Reset button appearance
    defineScaleBtn.classList.remove('active');

    // Update button text based on whether scale is set
    updateScaleButtonText();

    // Clear any temporary scale line
    tempScaleLine.points([]);
    layer.batchDraw();
}

// Function to update scale button text based on current scale
function updateScaleButtonText() {
    if (scalePixelsPerFoot !== null) {
        defineScaleBtn.textContent = `Scale: ${scalePixelsPerFoot.toFixed(2)} px/ft`;
    } else {
        defineScaleBtn.textContent = 'Define Scale';
    }
}

// Function to handle scale line drawing
function handleScaleLineDrawing(pos) {
    if (!scaleStartPoint) return;

    // Calculate the difference in x and y coordinates
    const dx = pos.x - scaleStartPoint.x;
    const dy = pos.y - scaleStartPoint.y;

    // Determine if the line should be horizontal or vertical based on which delta is larger
    let endX, endY;

    if (Math.abs(dx) >= Math.abs(dy)) {
        // Horizontal line
        endX = pos.x;
        endY = scaleStartPoint.y; // Keep y coordinate the same
    } else {
        // Vertical line
        endX = scaleStartPoint.x; // Keep x coordinate the same
        endY = pos.y;
    }

    // Update the temporary scale line
    tempScaleLine.points([scaleStartPoint.x, scaleStartPoint.y, endX, endY]);
    layer.batchDraw();

    // Store the current end point
    scaleEndPoint = { x: endX, y: endY };
}

// Function to complete scale definition
function completeScaleDefinition() {
    if (!scaleStartPoint || !scaleEndPoint) return;

    // Calculate the pixel length of the line
    const pixelLength = Math.sqrt(
        Math.pow(scaleEndPoint.x - scaleStartPoint.x, 2) +
        Math.pow(scaleEndPoint.y - scaleStartPoint.y, 2)
    );

    // Prompt the user for the real-world length in feet
    const realWorldLength = parseFloat(prompt('Enter the real-world length of the drawn line in feet:'));

    // Validate the input
    if (isNaN(realWorldLength) || realWorldLength <= 0) {
        alert('Please enter a valid positive number for the length.');
        return;
    }

    // Calculate the scale (pixels per foot)
    scalePixelsPerFoot = pixelLength / realWorldLength;

    // Exit scale definition mode
    exitScaleDefinitionMode();

    // Update the button text to show the calculated scale
    updateScaleButtonText();

    console.log(`Scale set: ${scalePixelsPerFoot.toFixed(2)} pixels per foot`);
}

// Add mousedown event handler for scale definition and debugging
stage.on('mousedown', (e) => {
    // Debug info
    const target = e.target;
    if (target instanceof Konva.Rect) {
        console.log('Mousedown on rectangle, draggable:', target.draggable());
    }

    // Only handle mousedown in scale definition mode
    if (!isScaleDefinitionMode) return;

    // Get mouse position relative to the stage
    const pos = stage.getPointerPosition();

    // Set the start point for the scale line
    scaleStartPoint = { x: pos.x, y: pos.y };

    // Initialize the temporary scale line
    tempScaleLine.points([pos.x, pos.y, pos.x, pos.y]);
    layer.batchDraw();
});

// Add mousemove event handler for scale definition
stage.on('mousemove', (e) => {
    // Only handle mousemove in scale definition mode and if we have a start point
    if (!isScaleDefinitionMode || !scaleStartPoint) return;

    // Get mouse position relative to the stage
    const pos = stage.getPointerPosition();

    // Update the scale line
    handleScaleLineDrawing(pos);
});

// Add mouseup event handler for scale definition
stage.on('mouseup', (e) => {
    // Only handle mouseup in scale definition mode and if we have a start point
    if (!isScaleDefinitionMode || !scaleStartPoint) return;

    // Get mouse position relative to the stage
    const pos = stage.getPointerPosition();

    // Finalize the scale line
    handleScaleLineDrawing(pos);

    // Complete the scale definition process
    completeScaleDefinition();
});

// Rectangle functionality

// Add Rectangle button handler
const addRectangleBtn = document.getElementById('add-rectangle-btn');
addRectangleBtn.addEventListener('click', showRectangleModal);

// Function to show the rectangle modal
function showRectangleModal() {
    // Check if scale is defined
    if (scalePixelsPerFoot === null) {
        alert('Please define the scale using the "Define Scale" button first.');
        return;
    }

    // Reset input fields
    rectangleWidthInput.value = '';
    rectangleHeightInput.value = '';
    rectangleLabelInput.value = '';

    // Show the modal
    rectangleModal.classList.add('show');
    rectangleWidthInput.focus();
}

// Function to hide the rectangle modal
function hideRectangleModal() {
    rectangleModal.classList.remove('show');
}

// Cancel button handler
cancelRectangleBtn.addEventListener('click', hideRectangleModal);

// Add Rectangle Confirm button handler
addRectangleConfirmBtn.addEventListener('click', createRectangle);

// Function to create a rectangle
function createRectangle() {
    // Get the input values
    const widthFeet = parseFloat(rectangleWidthInput.value);
    const heightFeet = parseFloat(rectangleHeightInput.value);
    const label = rectangleLabelInput.value.trim() || 'Unnamed Object';

    // Validate inputs
    if (isNaN(widthFeet) || widthFeet <= 0 || isNaN(heightFeet) || heightFeet <= 0) {
        alert('Please enter valid positive numbers for width and height.');
        return;
    }

    console.log(`Creating rectangle with dimensions: ${widthFeet}' x ${heightFeet}'`);
    console.log(`Using scale factor: ${scalePixelsPerFoot.toFixed(2)} pixels per foot`);

    // Calculate pixel dimensions using the scale
    const widthPixels = widthFeet * scalePixelsPerFoot;
    const heightPixels = heightFeet * scalePixelsPerFoot;
    console.log(`Calculated dimensions in pixels: ${widthPixels.toFixed(2)}px x ${heightPixels.toFixed(2)}px`);

    // Calculate the center position of the canvas
    const centerX = width / 2 - widthPixels / 2;
    const centerY = height / 2 - heightPixels / 2;

    // Create a group to hold the rectangle, text, and orientation indicator
    // This allows us to drag them together as a single unit
    const group = new Konva.Group({
        x: centerX + widthPixels / 2, // Position at the center of the rectangle
        y: centerY + heightPixels / 2, // Position at the center of the rectangle
        draggable: true,
    });

    // Create a rectangle shape (relative to the group)
    const rect = new Konva.Rect({
        x: -widthPixels / 2, // Position relative to group center
        y: -heightPixels / 2, // Position relative to group center
        width: widthPixels,
        height: heightPixels,
        fill: getRandomColor(0.6), // Different opacity to distinguish from room polygons
        stroke: '#000',
        strokeWidth: 2,
    });

    // Create a text label (relative to the group) with or without dimensions based on toggle
    // When showDimensions is false, only show the label
    const textContent = showDimensions ?
        `${label} (${widthFeet}' x ${heightFeet}')` :
        `${label}`;

    const text = new Konva.Text({
        x: 0, // Center position (0,0) since the group is now centered
        y: 0, // Center position (0,0) since the group is now centered
        text: textContent,
        fontSize: 16,
        fontFamily: 'Arial',
        fill: '#000',
        align: 'center',
        verticalAlign: 'middle',
        visible: false, // Hide text by default - only show on hover/select
    });

    // Center the text
    text.offsetX(text.width() / 2);
    text.offsetY(text.height() / 2);

    // Create a chevron down arrow at the bottom center of the rectangle
    // to indicate orientation
    const minChevronSize = 5; // Minimum size in pixels to ensure visibility
    const proportionalSize = Math.min(widthPixels, heightPixels) * 0.15;
    const chevronSize = Math.max(minChevronSize, proportionalSize); // Use the larger of min size or proportional size
    const chevronWidth = chevronSize;
    const chevronHeight = chevronSize * 0.6;

    // Create the chevron using a line with specific points
    const chevron = new Konva.Line({
        points: [
            -chevronWidth/2, heightPixels/2 - chevronHeight * 1.5, // Left point
            0, heightPixels/2 - chevronHeight * 0.5,              // Bottom point
            chevronWidth/2, heightPixels/2 - chevronHeight * 1.5  // Right point
        ],
        stroke: '#000',
        strokeWidth: 3, // Increased stroke width for better visibility
        closed: false,
        fill: null,
    });

    // Add the rectangle, text, and chevron to the group
    group.add(rect);
    group.add(text);
    group.add(chevron);

    // Add the group to the layer
    layer.add(group);

    // Store the object data
    const objectIndex = objects.length;
    objects.push({
        type: 'rectangle',
        label: label,
        width_feet: widthFeet,
        height_feet: heightFeet,
        x_pixels: centerX,
        y_pixels: centerY,
        rotation_degrees: 0, // Initialize rotation to 0 degrees
        group: group,
        shape: rect,
        text: text,
        chevron: chevron // Store reference to the chevron
    });

    // Add drag event handlers to update stored position
    group.on('dragend', () => {
        // Update the stored position
        // Subtract half width/height to store the top-left position
        objects[objectIndex].x_pixels = group.x() - widthPixels / 2;
        objects[objectIndex].y_pixels = group.y() - heightPixels / 2;
        console.log(`Object ${label} moved to position: (${objects[objectIndex].x_pixels.toFixed(2)}, ${objects[objectIndex].y_pixels.toFixed(2)})`);
    });

    // Add click handler for selection
    group.on('click', (e) => {
        // Prevent the event from bubbling to the stage
        e.cancelBubble = true;

        // Select this object
        selectObject(objectIndex);
        console.log(`Object ${label} selected, draggable: ${group.draggable()}`);
    });

    // Add hover event handlers to show/hide full text
    group.on('mouseenter', () => {
        // Show text on hover
        text.visible(true);
        layer.batchDraw();
    });

    group.on('mouseleave', () => {
        // Hide text when not hovering, unless selected
        if (selectedObjectIndex !== objectIndex) {
            text.visible(false);
            layer.batchDraw();
        }
    });

    // Hide the modal
    hideRectangleModal();

    // Select the newly created object
    selectObject(objectIndex);

    // Redraw the layer
    layer.batchDraw();

    console.log(`Successfully created object: ${label} with dimensions ${widthFeet}' x ${heightFeet}'`);
}

// Function to select an object
function selectObject(index) {
    // Deselect any previously selected object
    if (selectedObjectIndex !== -1) {
        deselectObject();
    }

    // Set the new selected object
    selectedObjectIndex = index;

    // Highlight the selected object
    const selectedObject = objects[selectedObjectIndex];
    selectedObject.shape.stroke('#ff0000');
    selectedObject.shape.strokeWidth(3);

    // Show text when selected
    selectedObject.text.visible(true);

    // Ensure the group is draggable
    selectedObject.group.draggable(true);

    // Bring the selected object to the front
    selectedObject.group.moveToTop();

    // Enable the rotate and delete buttons when an object is selected
    document.getElementById('rotate-object-btn').disabled = false;
    document.getElementById('rotate-left-btn').disabled = false;
    document.getElementById('delete-object-btn').disabled = false;

    // Redraw the layer
    layer.batchDraw();

    console.log('Object selected:', selectedObject);
}

// Function to deselect an object
function deselectObject() {
    if (selectedObjectIndex === -1) return;

    // Reset the appearance of the previously selected object
    const selectedObject = objects[selectedObjectIndex];
    selectedObject.shape.stroke('#000');
    selectedObject.shape.strokeWidth(2);

    // Hide text when deselected
    selectedObject.text.visible(false);

    // Reset the selected object index
    selectedObjectIndex = -1;

    // Disable the rotate and delete buttons when no object is selected
    document.getElementById('rotate-object-btn').disabled = true;
    document.getElementById('rotate-left-btn').disabled = true;
    document.getElementById('delete-object-btn').disabled = true;

    // Redraw the layer
    layer.batchDraw();
}

// Note: The stage click handler has been modified above to prioritize rectangle selection

// The export and import functions have been updated to properly handle objects

// Function to create an object from imported data
function createObjectFromData(objectData) {
    // Check if scale is defined
    if (scalePixelsPerFoot === null) {
        console.error('Scale is not defined. Cannot create object with proper dimensions.');
        return false;
    }

    if (objectData.type === 'rectangle') {
        console.log('Creating rectangle object:', objectData);
        console.log(`Using scale factor: ${scalePixelsPerFoot.toFixed(2)} pixels per foot`);

        // Handle both new format (feet) and legacy format (inches)
        let widthFeet, heightFeet;

        if (objectData.width_feet !== undefined && objectData.height_feet !== undefined) {
            // New format (feet)
            widthFeet = objectData.width_feet;
            heightFeet = objectData.height_feet;
            console.log(`Original dimensions in feet: ${widthFeet}' x ${heightFeet}'`);
        } else if (objectData.width_inches !== undefined && objectData.height_inches !== undefined) {
            // Legacy format (inches) - convert to feet
            widthFeet = objectData.width_inches / 12;
            heightFeet = objectData.height_inches / 12;
            console.log(`Converted dimensions from inches to feet: ${widthFeet.toFixed(2)}' x ${heightFeet.toFixed(2)}'`);
        } else {
            console.error('Invalid object data: Missing width and height dimensions');
            return false;
        }

        // Calculate pixel dimensions using the scale
        const widthPixels = widthFeet * scalePixelsPerFoot;
        const heightPixels = heightFeet * scalePixelsPerFoot;
        console.log(`Calculated dimensions in pixels: ${widthPixels.toFixed(2)}px x ${heightPixels.toFixed(2)}px`);

        // Calculate the center position for the group
        const centerX = objectData.x_pixels + widthPixels / 2;
        const centerY = objectData.y_pixels + heightPixels / 2;

        // Create a group to hold both the rectangle and text
        const group = new Konva.Group({
            x: centerX, // Position at the center of the rectangle
            y: centerY, // Position at the center of the rectangle
            draggable: true,
        });

        console.log(`Creating object at position: (${centerX.toFixed(2)}, ${centerY.toFixed(2)}) with dimensions: ${widthPixels.toFixed(2)}x${heightPixels.toFixed(2)} pixels`);

        // Create a rectangle shape (relative to the group)
        const rect = new Konva.Rect({
            x: -widthPixels / 2, // Position relative to group center
            y: -heightPixels / 2, // Position relative to group center
            width: widthPixels,
            height: heightPixels,
            fill: getRandomColor(0.6),
            stroke: '#000',
            strokeWidth: 2,
        });

        // Create a text label (relative to the group) with or without dimensions based on toggle
        // When showDimensions is false, only show the label
        const textContent = showDimensions ?
            `${objectData.label} (${widthFeet.toFixed(1)}' x ${heightFeet.toFixed(1)}')` :
            `${objectData.label}`;

        const text = new Konva.Text({
            x: 0, // Center position (0,0) since the group is now centered
            y: 0, // Center position (0,0) since the group is now centered
            text: textContent,
            fontSize: 16,
            fontFamily: 'Arial',
            fill: '#000',
            align: 'center',
            verticalAlign: 'middle',
            visible: false, // Hide text by default - only show on hover/select
        });

        // Center the text
        text.offsetX(text.width() / 2);
        text.offsetY(text.height() / 2);

        // Create a chevron down arrow at the bottom center of the rectangle
        // to indicate orientation
        const minChevronSize = 20; // Minimum size in pixels to ensure visibility
        const proportionalSize = Math.min(widthPixels, heightPixels) * 0.15;
        const chevronSize = Math.max(minChevronSize, proportionalSize); // Use the larger of min size or proportional size
        const chevronWidth = chevronSize;
        const chevronHeight = chevronSize * 0.6;

        // Create the chevron using a line with specific points
        const chevron = new Konva.Line({
            points: [
                -chevronWidth/2, heightPixels/2 - chevronHeight * 1.5, // Left point
                0, heightPixels/2 - chevronHeight * 0.5,              // Bottom point
                chevronWidth/2, heightPixels/2 - chevronHeight * 1.5  // Right point
            ],
            stroke: '#000',
            strokeWidth: 3, // Increased stroke width for better visibility
            closed: false,
            fill: null,
        });

        // Add the rectangle, text, and chevron to the group
        group.add(rect);
        group.add(text);
        group.add(chevron);

        // Add the group to the layer
        layer.add(group);

        // Store the object data
        const objectIndex = objects.length;
        objects.push({
            type: 'rectangle',
            label: objectData.label,
            width_feet: widthFeet,
            height_feet: heightFeet,
            x_pixels: objectData.x_pixels,
            y_pixels: objectData.y_pixels,
            rotation_degrees: objectData.rotation_degrees || 0, // Use imported rotation or default to 0
            group: group,
            shape: rect,
            text: text,
            chevron: chevron // Store reference to the chevron
        });

        // Apply rotation if it exists in the imported data
        const rotation = objectData.rotation_degrees || 0;
        group.rotation(rotation);

        // Keep the text orientation fixed by counter-rotating it
        // This cancels out the group rotation for the text only
        text.rotation(-rotation);

        // The chevron should rotate with the object to show orientation
        // so we don't counter-rotate it

        console.log(`Applied rotation of ${rotation} degrees to object: ${objectData.label}`);

        // Add drag event handlers to update stored position
        group.on('dragend', () => {
            // Update the stored position
            // Subtract half width/height to store the top-left position
            objects[objectIndex].x_pixels = group.x() - widthPixels / 2;
            objects[objectIndex].y_pixels = group.y() - heightPixels / 2;
            console.log(`Object ${objectData.label} moved to position: (${objects[objectIndex].x_pixels.toFixed(2)}, ${objects[objectIndex].y_pixels.toFixed(2)})`);
        });

        // Add click handler for selection
        group.on('click', (e) => {
            // Prevent the event from bubbling to the stage
            e.cancelBubble = true;

            // Select this object
            selectObject(objectIndex);
            console.log(`Object ${objectData.label} selected`);
        });

        // Add hover event handlers to show/hide full text
        group.on('mouseenter', () => {
            // Show text on hover
            text.visible(true);
            layer.batchDraw();
        });

        group.on('mouseleave', () => {
            // Hide text when not hovering, unless selected
            if (selectedObjectIndex !== objectIndex) {
                text.visible(false);
                layer.batchDraw();
            }
        });

        // Bring the group to the front to ensure it's visible
        group.moveToTop();

        // Redraw the layer to ensure the object is visible
        layer.batchDraw();

        console.log(`Successfully created object: ${objectData.label}`);
        return true; // Return true to indicate success
    } else {
        console.warn(`Unknown object type: ${objectData.type}`);
        return false; // Return false to indicate failure
    }
}

// Function to clear all objects
function clearAllObjects() {
    console.log(`Clearing ${objects.length} objects`);

    // Remove all object groups from the layer
    objects.forEach(obj => {
        if (obj && obj.group) {
            obj.group.destroy(); // This will also destroy all children (rect and text)
        }
    });

    // Clear the objects array
    objects = [];

    // Reset the selected object index
    selectedObjectIndex = -1;

    // Disable the rotate and delete buttons
    document.getElementById('rotate-object-btn').disabled = true;
    document.getElementById('rotate-left-btn').disabled = true;
    document.getElementById('delete-object-btn').disabled = true;

    // Redraw the layer
    layer.batchDraw();

    console.log('All objects cleared');
}

// Rotate Object buttons handlers
const rotateObjectBtn = document.getElementById('rotate-object-btn');
rotateObjectBtn.addEventListener('click', rotateSelectedObject);

// Rotate Left button handler
const rotateLeftBtn = document.getElementById('rotate-left-btn');
rotateLeftBtn.addEventListener('click', rotateSelectedObjectCounterclockwise);

// Delete Object button handler
const deleteObjectBtn = document.getElementById('delete-object-btn');
deleteObjectBtn.addEventListener('click', deleteSelectedObject);

// Function to delete the selected object
function deleteSelectedObject() {
    // Check if an object is selected
    if (selectedObjectIndex === -1) return;

    // Get the selected object
    const selectedObject = objects[selectedObjectIndex];

    // Remove the group from the layer (this removes both the rectangle and text)
    selectedObject.group.destroy();

    // Remove the object from the objects array
    objects.splice(selectedObjectIndex, 1);

    // Reset the selected object index
    selectedObjectIndex = -1;

    // Disable the rotate and delete buttons
    document.getElementById('rotate-object-btn').disabled = true;
    document.getElementById('rotate-left-btn').disabled = true;
    document.getElementById('delete-object-btn').disabled = true;

    // Update event handlers for remaining objects
    updateObjectEventHandlers();

    // Update the export button state
    updateExportButtonState();

    // Redraw the layer
    layer.batchDraw();

    console.log('Object deleted');
}

// Function to update object event handlers after deletion
function updateObjectEventHandlers() {
    // Remove all existing event handlers and add updated ones with correct indices
    objects.forEach((obj, index) => {
        obj.group.off('click');
        obj.group.off('dragend');
        obj.group.off('mouseenter');
        obj.group.off('mouseleave');

        // Add updated click handler for selection
        obj.group.on('click', (e) => {
            e.cancelBubble = true;
            selectObject(index);
            console.log(`Object ${obj.label} selected`);
        });

        // Add updated hover event handlers
        obj.group.on('mouseenter', () => {
            // Show text on hover
            obj.text.visible(true);
            layer.batchDraw();
        });

        obj.group.on('mouseleave', () => {
            // Hide text when not hovering, unless selected
            if (selectedObjectIndex !== index) {
                obj.text.visible(false);
                layer.batchDraw();
            }
        });

        // Add updated drag handler
        obj.group.on('dragend', () => {
            // Calculate the top-left position
            const widthPixels = obj.width_feet * scalePixelsPerFoot;
            const heightPixels = obj.height_feet * scalePixelsPerFoot;

            // Update the stored position
            obj.x_pixels = obj.group.x() - widthPixels / 2;
            obj.y_pixels = obj.group.y() - heightPixels / 2;
            console.log(`Object ${obj.label} moved to position: (${obj.x_pixels.toFixed(2)}, ${obj.y_pixels.toFixed(2)})`);
        });
    });
}

// Function to rotate the selected object
function rotateSelectedObject() {
    // Check if an object is selected
    if (selectedObjectIndex === -1) return;

    // Get the selected object
    const selectedObject = objects[selectedObjectIndex];

    // Calculate the new rotation angle
    const currentRotation = selectedObject.rotation_degrees || 0;
    const newRotation = (currentRotation + rotationIncrement) % 360;

    // Update the stored rotation value
    selectedObject.rotation_degrees = newRotation;

    // Apply the rotation to the group (which contains both the rectangle and text)
    selectedObject.group.rotation(newRotation);

    // Keep the text orientation fixed by counter-rotating it
    // This cancels out the group rotation for the text only
    selectedObject.text.rotation(-newRotation);

    // The chevron should rotate with the object to show orientation
    // so we don't counter-rotate it

    // Redraw the layer
    layer.batchDraw();

    console.log('Object rotated to:', newRotation, 'degrees');
}

// Function to rotate the selected object counterclockwise
function rotateSelectedObjectCounterclockwise() {
    // Check if an object is selected
    if (selectedObjectIndex === -1) return;

    // Get the selected object
    const selectedObject = objects[selectedObjectIndex];

    // Calculate the new rotation angle
    const currentRotation = selectedObject.rotation_degrees || 0;
    // Subtract the rotation increment and ensure the result is between 0 and 360
    const newRotation = (currentRotation - rotationIncrement + 360) % 360;

    // Update the stored rotation value
    selectedObject.rotation_degrees = newRotation;

    // Apply the rotation to the group (which contains both the rectangle and text)
    selectedObject.group.rotation(newRotation);

    // Keep the text orientation fixed by counter-rotating it
    // This cancels out the group rotation for the text only
    selectedObject.text.rotation(-newRotation);

    // The chevron should rotate with the object to show orientation
    // so we don't counter-rotate it

    // Redraw the layer
    layer.batchDraw();

    console.log('Object rotated to:', newRotation, 'degrees (counterclockwise)');
}

// Add keyboard event listener for rotating objects with 'r' and 'e' keys
document.addEventListener('keydown', (e) => {
    // Check if an object is selected
    if (selectedObjectIndex !== -1) {
        // Check which key was pressed
        if (e.key === 'r' || e.key === 'R') {
            // Rotate clockwise
            rotateSelectedObject();
            // Prevent default behavior (like scrolling)
            e.preventDefault();
        } else if (e.key === 'e' || e.key === 'E') {
            // Rotate counterclockwise
            rotateSelectedObjectCounterclockwise();
            // Prevent default behavior
            e.preventDefault();
        }
    }
});

// Function to update object label text based on showDimensions toggle
function updateObjectLabels() {
    objects.forEach(obj => {
        if (showDimensions) {
            // Show label with dimensions
            obj.text.text(`${obj.label} (${obj.width_feet}' x ${obj.height_feet}')`);
        } else {
            // Show only the label without dimensions
            obj.text.text(obj.label);
        }

        // Re-center the text after changing its content
        obj.text.offsetX(obj.text.width() / 2);
        obj.text.offsetY(obj.text.height() / 2);
    });

    // Redraw the layer to update the text
    layer.batchDraw();
}

// Add event listener for the show dimensions toggle
document.getElementById('show-dimensions-toggle').addEventListener('change', (e) => {
    showDimensions = e.target.checked;
    updateObjectLabels();
});

// Initial setup
updateExportButtonState();

// Set initial button states
document.getElementById('rotate-object-btn').disabled = true; // Initially disabled until an object is selected
document.getElementById('rotate-left-btn').disabled = true; // Initially disabled until an object is selected
document.getElementById('delete-object-btn').disabled = true; // Initially disabled until an object is selected

// Initial draw of all layers
backgroundLayer.batchDraw();
layer.batchDraw();

// Bootstrap handles the instructions toggle functionality

// Bootstrap Menu Event Handlers
document.getElementById('menu-new-plan').addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Are you sure you want to create a new floor plan? All unsaved changes will be lost.')) {
        // Clear all objects
        objects.forEach(obj => {
            if (obj.group) obj.group.destroy();
        });

        // Reset data structures
        objects = [];
        selectedObjectIndex = -1;

        // Update UI
        updateExportButtonState();
        // Reset import file name message
        importFileName.textContent = 'Furniture not loaded';
        layer.batchDraw();
    }
});

document.getElementById('menu-import').addEventListener('click', (e) => {
    e.preventDefault();
    // Trigger the file input click
    document.getElementById('json-upload').click();
});

document.getElementById('menu-export').addEventListener('click', (e) => {
    e.preventDefault();
    // Trigger the export function if enabled
    if (!document.getElementById('export-btn').disabled) {
        exportFloorGrid();
    } else {
        alert('You need to add at least one piece of furniture before exporting.');
    }
});

document.getElementById('menu-define-scale').addEventListener('click', (e) => {
    e.preventDefault();
    // Trigger the define scale functionality
    document.getElementById('define-scale-btn').click();
});

document.getElementById('menu-add-furniture').addEventListener('click', (e) => {
    e.preventDefault();
    // Trigger the add furniture functionality
    document.getElementById('add-rectangle-btn').click();
});

document.getElementById('menu-settings').addEventListener('click', (e) => {
    e.preventDefault();
    // Create a settings modal if it doesn't exist
    let settingsModal = document.getElementById('settings-modal');

    if (!settingsModal) {
        // Create the modal if it doesn't exist
        settingsModal = document.createElement('div');
        settingsModal.id = 'settings-modal';
        settingsModal.className = 'modal';
        settingsModal.innerHTML = `
            <div class="modal-content">
                <h3>Settings</h3>
                <div class="form-check form-switch mt-2">
                    <input class="form-check-input" type="checkbox" id="settings-show-dimensions" ${showDimensions ? 'checked' : ''}>
                    <label class="form-check-label" for="settings-show-dimensions">Show Dimensions</label>
                </div>
                <div class="modal-buttons">
                    <button id="settings-close-btn">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(settingsModal);

        // Add event listeners for the settings
        document.getElementById('settings-show-dimensions').addEventListener('change', (e) => {
            showDimensions = e.target.checked;
            document.getElementById('show-dimensions-toggle').checked = showDimensions;
            updateObjectLabels();
        });

        document.getElementById('settings-close-btn').addEventListener('click', () => {
            settingsModal.classList.remove('show');
        });
    }

    // Show the modal
    settingsModal.classList.add('show');
});