const width = 800;
const height = 600;
const closeThreshold = 10; // pixels distance to close polygon

// Initialize Konva Stage and Layers
const stage = new Konva.Stage({
    container: 'canvas-container',
    width: width,
    height: height,
});

// Create separate layers for background image and drawing elements
const backgroundLayer = new Konva.Layer(); // Layer for the background image
const layer = new Konva.Layer(); // Layer for grid and polygons

// Add layers to stage in the correct order (background first)
stage.add(backgroundLayer);
stage.add(layer);

// Data structure to store all polygons
let polygons = [];

// State variables for current polygon
let currentPolygon = {
    points: [],
    pointMarkers: [],
    shape: null,
    label: ''
};
let isDrawingComplete = false;

// State variables for polygon editing
let selectedPolygonIndex = -1; // Index of the currently selected polygon (-1 means none)
let vertexHandles = []; // Array to store vertex handle objects
let isEditMode = false; // Flag to track if we're in edit mode

// Create temporary line for current drawing
let tempLine = new Konva.Line({
    points: [],
    stroke: '#000',
    strokeWidth: 2,
});
layer.add(tempLine);

// Modal elements
const labelModal = document.getElementById('label-modal');
const polygonLabelInput = document.getElementById('polygon-label');
const saveLabelBtn = document.getElementById('save-label-btn');
const polygonCounter = document.getElementById('polygon-counter');

// Handle mouse clicks on stage
stage.on('click', (e) => {
    // Get the clicked target
    const clickedTarget = e.target;

    // If we're in edit mode, handle deselection
    if (isEditMode) {
        // Check if we clicked on a vertex handle or a polygon
        const clickedOnHandle = clickedTarget.hasName && clickedTarget.hasName('vertex-handle');
        const clickedOnPolygon = clickedTarget instanceof Konva.Line && clickedTarget.closed();

        // If we clicked outside both handles and polygons, deselect
        if (!clickedOnHandle && !clickedOnPolygon) {
            deselectPolygon();
        }
        return;
    }

    // If we're in the middle of drawing a polygon
    if (!isDrawingComplete) {
        const pos = stage.getPointerPosition();
        const x = pos.x;
        const y = pos.y;

        // Add point marker
        const point = new Konva.Circle({
            x: x,
            y: y,
            radius: 4,
            fill: '#000',
        });
        layer.add(point);
        currentPolygon.pointMarkers.push(point);

        currentPolygon.points.push({ x, y });

        // Enable commit button if we have at least 3 points
        if (currentPolygon.points.length >= 3) {
            document.getElementById('commit-btn').disabled = false;
        }

        // Check if click is close to first point to close polygon
        if (currentPolygon.points.length > 2) {
            const firstPoint = currentPolygon.points[0];
            const distance = Math.sqrt(
                Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2)
            );

            if (distance <= closeThreshold) {
                completePolygon();
                return;
            }
        }

        // Update polygon preview
        updatePolygonPreview();
    }
});

// Update temporary preview of the polygon
function updatePolygonPreview() {
    const flatPoints = currentPolygon.points.flatMap(p => [p.x, p.y]);
    tempLine.points(flatPoints);
    layer.batchDraw();
}

// Complete the polygon
function completePolygon() {
    isDrawingComplete = true;
    document.getElementById('commit-btn').disabled = true;

    // Create final polygon shape
    const flatPoints = currentPolygon.points.flatMap(p => [p.x, p.y]);
    const finalPolygon = new Konva.Line({
        points: flatPoints,
        stroke: '#000',
        strokeWidth: 2,
        fill: getRandomColor(0.3),
        closed: true,
        listening: true, // Make the polygon clickable
    });
    layer.add(finalPolygon);
    currentPolygon.shape = finalPolygon;

    // Remove temporary line
    tempLine.points([]);

    // Show label modal
    showLabelModal();

    layer.batchDraw();
}

// Show modal to enter label
function showLabelModal() {
    labelModal.classList.add('show');
    polygonLabelInput.focus();
}

// Save label and prepare for next polygon
function saveLabel() {
    const label = polygonLabelInput.value.trim() || 'Unnamed Area';
    currentPolygon.label = label;

    // Add label text to canvas
    addLabelToCanvas(currentPolygon);

    // Store the completed polygon
    const newPolygonIndex = polygons.length;
    polygons.push({
        vertices: [...currentPolygon.points],
        label: label,
        shape: currentPolygon.shape
    });

    // Add click event handler to the polygon for selection
    currentPolygon.shape.on('click', (e) => {
        // Prevent the event from bubbling to the stage
        e.cancelBubble = true;

        // Select this polygon for editing
        selectPolygon(newPolygonIndex);
    });

    // Update polygon counter
    updatePolygonCounter();

    // Reset for next polygon
    resetForNewPolygon();

    // Hide modal
    labelModal.classList.remove('show');
    polygonLabelInput.value = '';
}

// Add text label to the canvas
function addLabelToCanvas(polygon) {
    // Calculate center point of polygon
    const points = polygon.points;
    let sumX = 0, sumY = 0;

    for (const point of points) {
        sumX += point.x;
        sumY += point.y;
    }

    const centerX = sumX / points.length;
    const centerY = sumY / points.length;

    // Create label text
    const labelText = new Konva.Text({
        x: centerX,
        y: centerY,
        text: polygon.label,
        fontSize: 16,
        fontFamily: 'Arial',
        fill: '#000',
        padding: 5,
        align: 'center',
    });

    // Center the text
    labelText.offsetX(labelText.width() / 2);
    labelText.offsetY(labelText.height() / 2);

    layer.add(labelText);
    layer.batchDraw();
}

// Reset state for drawing a new polygon
function resetForNewPolygon() {
    isDrawingComplete = false;
    currentPolygon = {
        points: [],
        pointMarkers: [],
        shape: null,
        label: ''
    };
}

// This function is now defined at the bottom of the file with additional functionality

// Generate a random color with specified opacity
function getRandomColor(opacity = 1) {
    const r = Math.floor(Math.random() * 200);
    const g = Math.floor(Math.random() * 200);
    const b = Math.floor(Math.random() * 200);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Commit button handler
document.getElementById('commit-btn').addEventListener('click', () => {
    if (currentPolygon.points.length >= 3) {
        completePolygon();
    }
});

// Save label button handler
saveLabelBtn.addEventListener('click', saveLabel);

// Allow pressing Enter in the input field to save
polygonLabelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        saveLabel();
    }
});

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
    // Check if we have any polygons to export
    if (polygons.length === 0) {
        alert('No polygons to export. Create at least one polygon first.');
        return;
    }

    // Create a clean data structure with only the necessary data
    const exportData = polygons.map(polygon => ({
        label: polygon.label,
        vertices: polygon.vertices
    }));

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
    exportBtn.disabled = polygons.length === 0;
}

// Update the polygon counter display and export button state
function updatePolygonCounter() {
    polygonCounter.textContent = `Polygons: ${polygons.length}`;
    updateExportButtonState();
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
            // Parse the JSON data
            const importedData = JSON.parse(event.target.result);

            // Validate the data structure
            if (!Array.isArray(importedData)) {
                throw new Error('Invalid JSON format: Expected an array');
            }

            // Clear existing polygons
            clearAllPolygons();

            // Process each polygon in the imported data
            importedData.forEach(item => {
                // Validate required fields
                if (!item.label || !Array.isArray(item.vertices)) {
                    throw new Error('Invalid polygon data: Missing label or vertices');
                }

                // Create a new polygon from the imported data
                createPolygonFromData(item);
            });

            // Update the polygon counter
            updatePolygonCounter();

            // Show success message
            alert(`Successfully imported ${importedData.length} polygons`);

        } catch (error) {
            console.error('Error importing floor grid:', error);
            alert(`Error importing floor grid: ${error.message}`);
        }
    };

    reader.onerror = () => {
        alert('Error reading the file');
    };

    // Read the file as text
    reader.readAsText(file);

    // Display the file name
    document.getElementById('import-file-name').textContent = file.name;
}

// Function to clear all existing polygons
function clearAllPolygons() {
    // Remove all polygon shapes from the canvas
    polygons.forEach(polygon => {
        if (polygon.shape) {
            polygon.shape.destroy();
        }
    });

    // Clear the polygons array
    polygons = [];

    // Clear any text labels (find and remove all Text nodes)
    layer.find('Text').forEach(text => {
        text.destroy();
    });

    // Redraw the layer
    layer.batchDraw();
}

// Function to create a polygon from imported data
function createPolygonFromData(polygonData) {
    // Extract vertices and label
    const { vertices, label } = polygonData;

    // Create points array for Konva
    const flatPoints = vertices.flatMap(p => [p.x, p.y]);

    // Create the polygon shape
    const polygonShape = new Konva.Line({
        points: flatPoints,
        stroke: '#000',
        strokeWidth: 2,
        fill: getRandomColor(0.3),
        closed: true,
        listening: true, // Make the polygon clickable
    });

    // Add the shape to the layer
    layer.add(polygonShape);

    // Create a polygon object
    const polygon = {
        vertices: vertices,
        label: label,
        shape: polygonShape,
        points: vertices // Add points for label calculation
    };

    // Add label to the canvas
    addLabelToCanvas(polygon);

    // Store the polygon index before adding it
    const newPolygonIndex = polygons.length;

    // Add to polygons array
    polygons.push(polygon);

    // Add click event handler to the polygon for selection
    polygonShape.on('click', (e) => {
        // Prevent the event from bubbling to the stage
        e.cancelBubble = true;

        // Select this polygon for editing
        selectPolygon(newPolygonIndex);
    });

    // Redraw the layer
    layer.batchDraw();
}

// Import button and file input handlers
const importBtn = document.getElementById('import-btn');
const jsonUploadInput = document.getElementById('json-upload');

// Click on import button triggers file input
importBtn.addEventListener('click', () => {
    jsonUploadInput.click();
});

// Handle file selection
jsonUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        importFloorGrid(file);
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
});

// Polygon editing functions

// Function to select a polygon for editing
function selectPolygon(index) {
    // Deselect current polygon if any
    if (selectedPolygonIndex !== -1) {
        deselectPolygon();
    }

    selectedPolygonIndex = index;
    isEditMode = true;

    // Highlight the selected polygon
    const polygon = polygons[selectedPolygonIndex];
    polygon.shape.stroke('#3498db'); // Change stroke color to blue
    polygon.shape.strokeWidth(3); // Increase stroke width

    // Create vertex handles
    createVertexHandles();

    layer.batchDraw();
}

// Function to deselect the current polygon
function deselectPolygon() {
    if (selectedPolygonIndex === -1) return;

    const polygon = polygons[selectedPolygonIndex];

    // Reset polygon appearance
    polygon.shape.stroke('#000');
    polygon.shape.strokeWidth(2);

    // Remove vertex handles
    clearVertexHandles();

    // Update label position
    updateLabelPosition(selectedPolygonIndex);

    // Reset state
    selectedPolygonIndex = -1;
    isEditMode = false;

    layer.batchDraw();
}

// Function to create vertex handles for the selected polygon
function createVertexHandles() {
    const polygon = polygons[selectedPolygonIndex];
    const vertices = polygon.vertices;

    // Clear any existing handles
    clearVertexHandles();

    // Create a handle for each vertex
    vertices.forEach((vertex, i) => {
        const handle = new Konva.Circle({
            x: vertex.x,
            y: vertex.y,
            radius: 6,
            fill: '#ff0000',
            stroke: '#ffffff',
            strokeWidth: 1,
            draggable: true,
            name: 'vertex-handle',
        });

        // Add drag event handlers
        handle.on('dragmove', () => {
            updatePolygonVertex(i, handle.x(), handle.y());
        });

        layer.add(handle);
        vertexHandles.push(handle);
    });

    // Bring handles to the front
    vertexHandles.forEach(handle => handle.moveToTop());

    layer.batchDraw();
}

// Function to clear vertex handles
function clearVertexHandles() {
    vertexHandles.forEach(handle => {
        handle.destroy();
    });
    vertexHandles = [];
}

// Function to update a polygon vertex during dragging
function updatePolygonVertex(vertexIndex, x, y) {
    const polygon = polygons[selectedPolygonIndex];

    // Update the vertex coordinates
    polygon.vertices[vertexIndex].x = x;
    polygon.vertices[vertexIndex].y = y;

    // Update the shape points
    const flatPoints = polygon.vertices.flatMap(p => [p.x, p.y]);
    polygon.shape.points(flatPoints);

    // Redraw the layer
    layer.batchDraw();
}

// Function to update label position after editing
function updateLabelPosition(polygonIndex) {
    const polygon = polygons[polygonIndex];
    const vertices = polygon.vertices;

    // Calculate new center point
    let sumX = 0, sumY = 0;
    for (const vertex of vertices) {
        sumX += vertex.x;
        sumY += vertex.y;
    }
    const centerX = sumX / vertices.length;
    const centerY = sumY / vertices.length;

    // Find and update the label text
    const labelTexts = layer.find('Text');
    for (const text of labelTexts) {
        // We need to identify which text belongs to this polygon
        // This is a simplification - in a real app, you might want to store a reference
        if (text.text() === polygon.label) {
            text.x(centerX);
            text.y(centerY);
            text.offsetX(text.width() / 2);
            text.offsetY(text.height() / 2);
            break;
        }
    }
}

// Initial setup
updateExportButtonState();

// Initial draw of all layers
backgroundLayer.batchDraw();
layer.batchDraw();