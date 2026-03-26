const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const fs = require('fs');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const imagePart = {
      inlineData: {
        data: fs.readFileSync('./images/product_serum.png', {encoding: 'base64'}),
        mimeType: 'image/png'
      }
    };
    const prompt = `Test prompt describing the image`;
    const result = await model.generateContent([prompt, imagePart]);
    console.log(result.response.text());
  } catch(err) {
    console.error("FULL ERROR:", err);
  }
}
test();
