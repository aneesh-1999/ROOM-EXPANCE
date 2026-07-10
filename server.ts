import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const PORT = 3000;
const app = express();

// Increase body size limit to handle uploaded receipt images
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Initialize GoogleGenAI SDK (lazy-load or direct config)
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required but missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// API Endpoint for Receipt Scanning (OCR) using Gemini 3.5 Flash
app.post('/api/ocr-receipt', async (req, res) => {
  try {
    const { image, mimeType } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image data provided.' });
    }

    // Clean up the base64 string
    let base64Data = image;
    let actualMimeType = mimeType || 'image/jpeg';
    if (image.includes(';base64,')) {
      const parts = image.split(';base64,');
      actualMimeType = parts[0].replace('data:', '');
      base64Data = parts[1];
    } else if (image.includes(',')) {
      base64Data = image.split(',')[1];
    }

    const ai = getAiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: actualMimeType
          }
        },
        {
          text: 'Analyze this receipt or bill image. Extract the store or merchant name, the date of purchase (or transaction), the total amount, any individual line items with their names/descriptions and prices, and the VAT amount if listed.'
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            store: { 
              type: Type.STRING, 
              description: 'The name of the store or merchant (e.g. Lidl, Aldi, Tesco, restaurant name). Default to Unknown if not found.' 
            },
            date: { 
              type: Type.STRING, 
              description: 'Date of the transaction in YYYY-MM-DD format. Default to today or blank if not found.' 
            },
            total: { 
              type: Type.NUMBER, 
              description: 'The total transaction amount in EUR. Make sure to parse it as a valid float number.' 
            },
            vat: { 
              type: Type.NUMBER, 
              description: 'The VAT or Tax amount in EUR if explicitly listed, otherwise null or 0.' 
            },
            items: {
              type: Type.ARRAY,
              description: 'List of individual line items purchased.',
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Description or name of the item' },
                  price: { type: Type.NUMBER, description: 'Price of the item in EUR' }
                },
                required: ['name', 'price']
              }
            }
          },
          required: ['store', 'total']
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini model did not return any text output.');
    }

    const parsedData = JSON.parse(text.trim());
    return res.json(parsedData);
  } catch (error: any) {
    console.error('Error processing receipt OCR:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze receipt. ' + (error.message || error) 
    });
  }
});

// Setup Vite or static serving
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
