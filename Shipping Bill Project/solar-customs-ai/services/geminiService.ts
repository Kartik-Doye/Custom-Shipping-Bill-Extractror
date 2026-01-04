import { GoogleGenAI } from "@google/genai";
import { ExtractedData } from "../types";

const PROMPT_INSTRUCTIONS = `
You are an EXPERT AI for extracting Indian Customs Shipping Bills with HIERARCHICAL STRUCTURE from DIGITAL PDFs.
Process the file strictly as a digital document. 

🎯 CRITICAL: Extract data in 3-LEVEL HIERARCHY:
SHIPPING BILL LEVEL (once per document)
INVOICE LEVEL (multiple invoices per SB)
ITEM LEVEL (multiple items per invoice)

===========================================
EXTRACTION STRUCTURE
Return JSON in this EXACT format:
{
"shipping_bill_header": {
"SB NO.": "...",
"S/B Date": "...",
"LEO Date": "...",
"PORT CODE": "...",
"CUSTOMER NAME": "...",
"COUNTRY": "..."
},
"invoices": [
{
"FINAL INVOICE NO": "...",
"Total Invoice Value in FC as per SB": "...",
"INCOTERMS": "...",
"Currency of export": "...",
"Custom Exchange Rate in FC": "...",
"FREIGHT_TOTAL": "...",
"INSURANCE_TOTAL": "...",
"items": [
{
"H.S. Itch code": "...",
"PRODUCT GROUP": "...",
"Qty": "...",
"Unit": "...",
"FOB Value as per SB in INR": "...",
"DRAWBACK Receivable on fob": "...",
"RoDTEP RECEIVABLE": "...",
"SCHEME (ADV/DFIA/DRAWBACK)": "..."
}
]
}
]
}

===========================================
CRITICAL MAPPING RULES (HOW TO FIND VALUES)

1. CUSTOMER NAME (CRITICAL):
   - GO TO SECTION: "Part I" or Header Details.
   - LOCATE FIELD: "Buyer Name" or "Buyer Details".
   - EXTRACT: The Name of the Buyer.
   - EXCLUDE: Do NOT extract "Exporter" or "Consignee" (unless Consignee is the same as Buyer). We strictly need the BUYER NAME.

2. FREIGHT & INSURANCE:
   - GO TO SECTION: "Part II - INVOICE DETAILS" (Do not look in Part III).
   - LOCATE COLUMN: Scan headers aggressively. Common variations:
     * "Freight", "3.Freight", "3.FREIGHT", "3FREIGHT" (merged), "Freight (FC)", "FREIGHT".
     * "Insurance", "4.Insurance", "4.INSURANCE", "4INSURANCE" (merged), "INSURANCE".
   - ROW ALIGNMENT & WRAPPING:
     * Values are usually on the same line as the Invoice Number.
     * CRITICAL: If the value is missing/blank on the main line, look at the IMMEDIATE NEXT LINE (wrapped text). Shipping bills often wrap currency/amounts to the row below the invoice number.
   - INCOTERMS CHECK: 
     * If Incoterms column is "FOB", Freight/Insurance is often 0. 
     * If Incoterms is "CIF" or "CFR", Freight MUST be present.
   - EXTRACT: The Foreign Currency value (e.g., "125.00", "50.00").

3. INVOICE NUMBER MATCHING (Part II vs Part III):
   - Part II (Invoice Details) and Part III (Item Details) must be linked.
   - MATCHING PROBLEM: Part II might show "001" while Part III shows "INV/2024/001".
   - RULE: Match invoices by fuzzy logic. If the numeric suffix matches (e.g. "001" in "INV...001"), treat them as the same invoice. 
   - If a date is appended in Part II (e.g. "001 dt 01/01/24"), ignore the "dt..." part and match "001".

4. EXCHANGE RATE:
   - GO TO SECTION: "Part II - INVOICE DETAILS".
   - EXTRACT: The specific "Rate" or "Exchange Rate" listed for the invoice. 
   - REASON: Do NOT use the standard rate from the header if a specific invoice rate exists.

5. FOB VALUE:
   - GO TO SECTION: "Part III - ITEM DETAILS".
   - LOCATE COLUMN: "9.FOB (INR)" or "FOB(INR)".
   - EXTRACT: The value for each specific item row.

6. PRODUCT GROUP / DESCRIPTION:
   - EXTRACT: The COMPLETE "Item Description" text from Part III. 
   - RULE: Do NOT truncate. Do NOT summarize. Copy exactly as appears in the PDF.

7. LEO DATE (VISUAL CHECK):
   - GO TO SECTION: "J. PROCESS DETAILS" or "J.PROCESS DETAILS".
   - PAGE LOCATION: Check both the LAST PAGE and the SECOND LAST PAGE.
   - LABEL IDENTIFICATION: Scan for the row labeled exactly as:
     * "9. LEO"
     * "LEO Date"
     * "Let Export Order"
     * "9. Let Export Order"
   - EXTRACT: The Date portion only (DD-MMM-YYYY). Ignore timestamps.

8. RoDTEP & DRAWBACK (VISUAL CHECK):
   - GO TO SECTION: "PART IV - EXPORT SCHEME DETAILS" (also known as Table M).
   - TABLE HEADERS: Look for specific columns: "Item SNo", "RoDTEP Rate", "RoDTEP Amt", "Reward Value".
   - CRITICAL LINKING: The table MUST have a column "Item S.No" (or "Item No") that links it to the items in Part III.
   - LOGIC: Find the row in Part IV where "Item S.No" matches the Item Number from Part III and extract the Amount.
   - IF TABLE IS MISSING: Return "0" for RoDTEP.

===========================================
DATA CLEANING RULES
- NUMBERS: Remove ALL non-numeric characters except decimal point.
- EXCHANGE RATE: INR value ONLY.
- DATES: Keep DD-MMM-YYYY format.
- INVOICE NUMBERS: Extract the cleaner/fuller version if available, or just the number.
- NULL VALUES: If a numeric value is missing or "-", return "0".

⚠️ Output ONLY valid JSON. No markdown fencing.
`;

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const base64Content = base64data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const processShippingBill = async (file: File): Promise<ExtractedData> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-2.5-flash";

  try {
    const filePart = await fileToGenerativePart(file);

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
            filePart,
            { text: PROMPT_INSTRUCTIONS }
        ]
      },
      config: {
        responseMimeType: "application/json",
        temperature: 0.1, // Low temperature for factual extraction
      }
    });

    const text = response.text;
    if (!text) {
        throw new Error("No data returned from Gemini.");
    }

    // Basic cleaning if the model ignores the "no markdown" rule
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(cleanText) as ExtractedData;

  } catch (error) {
    console.error("Error processing shipping bill:", error);
    throw error;
  }
};