import * as pdfjsLib from 'pdfjs-dist/build/pdf';

// Set the workerSrc so pdf.js can load its worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.js`;

/**
 * Converts each page of a PDF file to a base64-encoded JPEG image.
 * @param {File|Blob} file - The PDF file to convert.
 * @param {boolean} countOnly - Whether to return only the page count.
 * @returns {Promise<string[]|number>} A promise that resolves with an array of base64 image data or the page count.
 */
export async function convertPdfToImages(file, countOnly = false) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
    
    if (countOnly) {
      return pdf.numPages;
    }

    const totalPages = pdf.numPages;
    const images = [];

    // Loop through each page in the PDF
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      // Get the current page
      const page = await pdf.getPage(pageNum);
      // Define a viewport with a chosen scale factor (adjust as needed)
      const viewport = page.getViewport({ scale: 1.5 });
      // Create a canvas element to render the page
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      
      // Set up the render context
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      // Render the page into the canvas
      await page.render(renderContext).promise;
      // Convert the rendered canvas to a data URL (JPEG format)
      const dataUrl = canvas.toDataURL('image/jpeg');
      // Remove the "data:image/jpeg;base64," prefix and store the base64 string
      images.push(dataUrl.split(',')[1]);
    }
    
    return images;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw error;
  }
}
