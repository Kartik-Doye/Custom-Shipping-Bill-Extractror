import streamlit as st
import pandas as pd
import time
from datetime import datetime
import os
import io
import tempfile
import json
import re
import uuid
import pdfplumber
from langchain_ollama import ChatOllama

# ==============================================================================
# 1. CONFIGURATION & SETUP
# ==============================================================================

# --- App Constants ---
APP_TITLE = "Solar Customs AI"
FINAL_COLUMNS = [
    "Sr. No.",
    "SB NO.",
    "S/B Date",
    "LEO Date",
    "Customer Name",
    "Final Invoice No.",
    "SB – Solar / Other Goods",
    "Port Code",
    "Incoterms",
    "Country",
    "H.S. ITC (HS Code)",
    "Product Group",
    "Qty",
    "Unit",
    "FOB Value Declared by Us (S/B) in FC",
    "Currency of Export",
    "Custom Exchange Rate (in FC)",
    "LEO Date Exchange Rate (in FC)",
    "FOB Value as per SB in INR",
    "FOB Value as per LEO Ex. Rate in INR",
    "Scheme (ADV/DFIA/Drawback)",
    "DBK %",
    "Drawback Receivable on FOB",
    "RoDTEP %",
    "RoDTEP Receivable",
    "RoDTEP Y/N",
    "Balance RoDTEP",
]

# --- Page & Theme ---
st.set_page_config(
    page_title=APP_TITLE,
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# --- Theme Colors ---
TRUST_BLUE = "#ffffff"
SOLAR_RED = "#CD001E"

# --- LLM SETUP ---
@st.cache_resource
def init_llm():
    try:
        return ChatOllama(
            model="qwen2.5vl:32b", temperature=0.1, num_ctx=32768, format="json",
            base_url="http://172.17.54.24:11434"
            
        )
    except Exception as e:
        st.error(f"Failed to initialize AI Model. Is the server running? Error: {e}")
        return None

llm = init_llm()

# ==============================================================================
# 2. BACKEND DATA PROCESSING FUNCTIONS
# ==============================================================================

def clean_number(value):
    if not value: return 0.0
    if isinstance(value, (int, float)): return float(value)
    clean_str = re.sub(r'[^\d.-]', '', str(value))
    try: return float(clean_str)
    except: return 0.0

def extract_pdf_text(pdf_bytes):
    full_text = ""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(pdf_bytes); tmp.flush(); tmp_path = tmp.name
    try:
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                full_text += page.extract_text(layout=True) or ""
    finally:
        try: os.remove(tmp_path)
        except: pass
    return full_text

def get_hierarchical_json(text):
    if not llm: return None
    prompt = f"""
    You are a Customs Data Specialist. Parse this Shipping Bill into a strictly hierarchical JSON.

    **CRITICAL MAPPING RULES:**
    
    1. **CUSTOMER NAME (CRITICAL)**:
       - GO TO SECTION: "Part I" or Header Details.
       - LOCATE FIELD: "Buyer Name" or "Buyer Details".
       - EXTRACT: The Name of the Buyer.
       - EXCLUDE: Do NOT extract "Exporter" or "Consignee" (unless Consignee is the same as Buyer). We strictly need the BUYER NAME.
    
    2. **LEO DATE (CRITICAL - DD-MMM-YYYY format)**:
       - **LOCATE RELEVANT SECTION**: Scan for "J. PROCESS DETAILS" (usually bottom-left quadrant, y ≈ 85%). Restrict parsing to this block.
       - **ENTITY EXTRACTION & VALIDATION (Two-Pointer Method)**:
         - **Strategy A (Key-Value Pair Mapping)**:
           - Search Pattern: Locate label "6. LEO Date." (or similar).
           - Fetch: Extract value from immediate sibling cell to the right.
         - **Strategy B (Grid/Table Intersection)**:
           - Identify Column Index: "2. DATE".
           - Identify Row Index: "9. LEO" (or "Let Export Order").
           - Fetch: Extract value from the intersection of this row and column.
         - **Validation**: Cross-reference Strategy A and Strategy B. If they match, use that date. If they differ, prefer the date from "6. LEO Date.".
       - **FINAL EXTRACT**: The validated Date portion ONLY in DD-MMM-YYYY format (e.g., 10-MAY-25). Ignore timestamps or status.

    3. **S/B Date**: Extract the date in DD-MMM-YYYY format.
       
    4. **PORT CODE**: Extract the "Port of Loading" (Origin) from Page 1 header.
    
    5. **INVOICES (Part II)**: 
       - **FINAL INVOICE NO**: Extract the cleaner/fuller version if available, or just the number.
       - Extract "3.FREIGHT" and "4.INSURANCE" (Total amounts in Foreign Currency).
       - Extract "Exchange Rate".
       
    6. **ITEMS (Part III)**: 
       - **PRODUCT GROUP**: Extract the COMPLETE "Item Description" text. Do NOT truncate or summarize. Copy it exactly as it appears.
       - **FOB VALUE**: Extract strictly from "Part III - ITEM DETAILS". Look for the column "FOB (INR)" or "9.FOB". Use this declared value.
       - **SCHEME CODE**: Look for column "18.SCHCOD" or similar in Part III, or the Scheme Code in Part IV (e.g., "19"). 
       
    7. **SCHEMES (Part IV)**: 
       - Match Item Serial Nos to find Drawback and RoDTEP amounts.

    **JSON OUTPUT FORMAT:**
    {{
      "shipping_bill_header": {{"SB NO.": "string", "S/B Date": "string", "LEO Date": "string", "PORT CODE": "string", "CUSTOMER NAME": "string", "COUNTRY": "string", "SB_TYPE": "string"}},
      "invoices": [{{ "FINAL INVOICE NO": "string", "INCOTERMS": "string", "Currency of export": "string", "Custom Exchange Rate in FC": "number", "FREIGHT_TOTAL_FC": "number", "INSURANCE_TOTAL_FC": "number",
          "items": [{{ "H.S. Itch code": "string", "PRODUCT GROUP": "string", "Qty": "number", "Unit": "string", "FOB Value as per SB in INR": "number", "SCHEME_CODE": "string", "SCHEME_NAME": "string", "DRAWBACK Receivable on fob": "number", "RoDTEP RECEIVABLE": "number"}}]
      }}]
    }}

    **DOCUMENT TEXT:**
    {text}
    
    ⚠️ Output ONLY valid JSON. No markdown fencing.
    """
    try:
        resp = llm.invoke(prompt)
        content = resp.content if hasattr(resp, "content") else resp
        clean_json = content.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)
    except Exception as e:
        st.error(f"AI parsing failed. The document might be unreadable or have an unusual format. Error: {e}")
        return None

def flatten_to_excel_rows(hierarchical_data):
    flat_rows = []
    header = hierarchical_data.get("shipping_bill_header", {})
    invoices = hierarchical_data.get("invoices", [])
    
    for inv in invoices:
        items = inv.get("items", [])
        item_count = len(items) if len(items) > 0 else 1
        
        ex_rate = clean_number(inv.get("Custom Exchange Rate in FC"))
        currency = inv.get("Currency of export", "USD")
        
        for item in items:
            fob_inr = clean_number(item.get("FOB Value as per SB in INR"))
            qty = clean_number(item.get("Qty"))
            dbk_amt = clean_number(item.get("DRAWBACK Receivable on fob"))
            rodtep_amt = clean_number(item.get("RoDTEP RECEIVABLE"))
            
            fob_fc = (fob_inr / ex_rate) if ex_rate > 0 else 0
            
            rodtep_pct = (rodtep_amt / fob_inr * 100) if fob_inr > 0 else 0
            dbk_pct = (dbk_amt / fob_inr * 100) if fob_inr > 0 else 0
            
            # Get the full description
            description = item.get("PRODUCT GROUP", "").strip()

            # Set values based on new user rules
            final_scheme = "DRAWBACK"
            product_group_val = description
            sb_type = description
            
            row = {
                "Sr. No.": "", "SB NO.": header.get("SB NO.", ""), "S/B Date": header.get("S/B Date", ""),
                "LEO Date": header.get("LEO Date", ""), "Customer Name": header.get("CUSTOMER NAME", ""),
                "Final Invoice No.": inv.get("FINAL INVOICE NO", ""), 
                "SB – Solar / Other Goods": sb_type, # Value is now the full description
                "Port Code": header.get("PORT CODE", ""), "Incoterms": inv.get("INCOTERMS", ""),
                "Country": header.get("COUNTRY", ""), "H.S. ITC (HS Code)": item.get("H.S. Itch code", ""),
                "Product Group": product_group_val, # Value is the full description
                "Qty": qty, "Unit": item.get("Unit", ""),
                "FOB Value Declared by Us (S/B) in FC": round(fob_fc, 2), "Currency of Export": currency,
                "Custom Exchange Rate (in FC)": ex_rate, "LEO Date Exchange Rate (in FC)": ex_rate, 
                "FOB Value as per SB in INR": round(fob_inr, 2), "FOB Value as per LEO Ex. Rate in INR": round(fob_inr, 2),
                "Scheme (ADV/DFIA/Drawback)": final_scheme, # Default value "DRAWBACK"
                "DBK %": f"{dbk_pct:.2f}", "Drawback Receivable on FOB": round(dbk_amt, 2),
                "RoDTEP %": f"{rodtep_pct:.2f}",
                "RoDTEP Receivable": round(rodtep_amt, 2), "RoDTEP Y/N": "Yes" if rodtep_amt > 0 else "No",
                "Balance RoDTEP": round(rodtep_amt, 2),
            }
            flat_rows.append(row)
    return flat_rows

def format_inr(value):
    if value >= 1_000_000: return f"₹{value/1_000_000:.1f}M"
    if value >= 1_000: return f"₹{value/1_000:.1f}K"
    return f"₹{value:.0f}"

# ==============================================================================
# 3. UI & THEME (CSS)
# ==============================================================================
st.markdown(f"""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap');
        .stApp {{ background-color: {TRUST_BLUE}; font-family: 'Montserrat', sans-serif; color: #E6E6E6; }}
        #MainMenu, footer, header {{visibility: hidden;}}
        @keyframes propel {{ 0% {{ opacity: 0; transform: translateY(20px); }} 100% {{ opacity: 1; transform: translateY(0); }} }}
        @keyframes pulse-red {{ 0% {{ box-shadow: 0 0 0 0 rgba(205, 0, 30, 0.4); }} 70% {{ box-shadow: 0 0 0 10px rgba(205, 0, 30, 0); }} 100% {{ box-shadow: 0 0 0 0 rgba(205, 0, 30, 0); }} }}
        .animate-propel {{ animation: propel 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }}
        .delay-100 {{ animation-delay: 0.1s; }} .delay-200 {{ animation-delay: 0.2s; }} .delay-300 {{ animation-delay: 0.3s; }}
        .bg-shape-1 {{ position: fixed; top: -20%; right: -10%; width: 80vw; height: 120vh; background-color: rgba(255, 255, 255, 0.05); transform: rotate(-13deg); z-index: 0; pointer-events: none; }}
        .bg-shape-2 {{ position: fixed; bottom: -10%; left: -10%; width: 50vw; height: 80vh; background-color: rgba(195, 220, 250, 0.05); transform: rotate(13deg); z-index: 0; pointer-events: none; }}
        .solar-header {{ display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid #374151; margin-bottom: 2rem; position: relative; z-index: 10; background:#ffffff; backdrop-filter: blur(10px); }}
        .logo-tagline {{ font-size: 10px; font-weight: 700; color: {SOLAR_RED}; text-transform: uppercase; letter-spacing: 0.3em; }}
                .status-badge {{
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #cd001e;
                    position: relative;
                    right: 2cm;
                }}
        .status-dot {{ width: 8px; height: 8px; background-color: #22c55e; border-radius: 50%; box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2); animation: pulse-red 2s infinite; }}
        .hero-tag {{ display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; background-color: {SOLAR_RED}; color: white; font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; border-radius: 2px; margin-bottom: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }}
        .hero-title {{ font-size: 8rem; font-weight: 800; line-height: 1; letter-spacing: -0.02em; margin-bottom: 1.5rem; color: #cd001e; }}
        .highlight-text {{ background: linear-gradient(to right, {SOLAR_RED}, #ff0000); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
        .solar-card {{ background: #111827; border: 1px solid #374151; padding: 1.5rem; border-radius: 2px; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; height: 100%; }}
        .solar-card:hover {{ transform: translateY(-5px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); border-color: rgba(205, 0, 30, 0.5); }}
        .metric-label {{ font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }}
        .metric-value {{ font-size: 28px; font-weight: 800; color: #FFFFFF; }}
        .stButton button {{ background-color: {SOLAR_RED}; color: white; border: none; padding: 0.6rem 1.2rem; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; border-radius: 2px; transition: all 0.3s ease; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }}
        .stButton button:hover {{ background-color: #ff0000; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2); transform: translateY(-1px); }}

        .upload-card-container .solar-card {{
            min-height: 400px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }}

        /* Style for the "Browse files" button */
        section[data-testid="stFileUploader"] button {{
            background: linear-gradient(to right, {SOLAR_RED}, #ff0000);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 900;
            border: 1px solid {SOLAR_RED};
        }}
    </style>
""", unsafe_allow_html=True)

# ==============================================================================
# 4. SESSION STATE INITIALIZATION
# ==============================================================================
if 'show_dashboard' not in st.session_state:
    st.session_state.show_dashboard = False
if 'df' not in st.session_state:
    st.session_state.df = pd.DataFrame()

# ==============================================================================
# 5. UI RENDERING
# ==============================================================================

def main():
    # --- Background & Header ---
    st.markdown('<div class="bg-shape-1"></div><div class="bg-shape-2"></div>', unsafe_allow_html=True)
    st.markdown(f"""
        <div class="solar-header animate-propel">
            <div>
                <img src="https://solargroup.com/img/logo.png" alt="Solar Group Logo" style="height: 40px;">
                <div class="logo-tagline">Power to Propel</div>
            </div>
            <div><div class="status-badge"><div class="status-dot"></div>System Active</div></div>
        </div>
    """, unsafe_allow_html=True)

    # --- PAGE ROUTING ---
    if not st.session_state.show_dashboard:
        render_upload_page()
    else:
        render_dashboard_page()

def render_upload_page():
    """Renders the initial file upload screen."""
    st.markdown(f"""
        <div style="text-align: center; margin-top: 4rem; margin-bottom: 3rem;" class="animate-propel delay-100">
            <div class="hero-tag"><span>AI-Powered Intelligence</span></div>
            <h1 class="hero-title">Powering <br><span class="highlight-text">Digital Progress</span></h1>
            <p style="color: #6b7280; font-size: 1.1rem; max-width: 600px; margin: 0 auto; line-height: 1.6; font-weight: 500;">
                Accelerate your customs workflow. Batch upload Shipping Bills (PDFs) to instantly extract, structure, and edit data.
            </p>
        </div>
    """, unsafe_allow_html=True)

    col1, col2, col3 = st.columns([1, 8, 1])
    with col2:
        st.markdown('<div class="upload-card-container">', unsafe_allow_html=True)
        st.markdown('<div class="solar-card animate-propel delay-200">', unsafe_allow_html=True)
        st.markdown('<h4 style="font-weight: 700; text-transform: uppercase; text-align: center; color: #cd001e">Drag & Drop Shipping Bills</h4>', unsafe_allow_html=True)
        
        uploaded_files = st.file_uploader(
            "Upload Shipping Bills (PDF)", type="pdf", accept_multiple_files=True, label_visibility="collapsed"
        )
        st.markdown('</div>', unsafe_allow_html=True)
        st.markdown('</div>', unsafe_allow_html=True)
        
        if uploaded_files:
            if st.button("PROPELL DATA EXTRACTION ⚡"):
                process_files(uploaded_files)

def render_dashboard_page():
    """Renders the data dashboard after processing."""
    t1, t2 = st.columns([6, 1])
    with t1:
        st.markdown('<h3 class="animate-propel">📊 Data Grid</h3>', unsafe_allow_html=True)
    with t2:
        if st.button("Reset"):
            st.session_state.show_dashboard = False
            st.session_state.df = pd.DataFrame()
            st.rerun()

    df = st.session_state.df
    if df.empty:
        st.warning("No data to display. Please go back and upload files.")
        return

    # --- METRICS ---
    total_invoices = len(df['Final Invoice No.'].unique())
    total_fob_inr = df['FOB Value as per SB in INR'].sum()
    total_benefits = df['Drawback Receivable on FOB'].sum() + df['RoDTEP Receivable'].sum()

    m1, m2, m3 = st.columns(3)
    m1.metric("Invoices", f"{total_invoices}")
    m2.metric("Total FOB (INR)", format_inr(total_fob_inr))
    m3.metric("Total Benefits", format_inr(total_benefits))

    st.write("") 

    # --- DATA GRID ---
    st.markdown('<div class="animate-propel delay-200">', unsafe_allow_html=True)
    st.data_editor(
        df,
        width='stretch',
        num_rows="dynamic",
        column_config={
            "FOB Value as per SB in INR": st.column_config.NumberColumn(format="₹%.2f"),
            "Total Invoice Value in FC as per SB": st.column_config.NumberColumn(format="%.2f"),
        }
    )
    st.markdown('</div>', unsafe_allow_html=True)
    
    # --- DOWNLOAD BUTTON ---
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name='ShippingBills')
    st.download_button(
        label="Download as Excel",
        data=buffer.getvalue(),
        file_name="Solar_SB_Export.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

def process_files(uploaded_files):
    """The main logic to extract, process, and store data."""
    if not llm:
        st.error("Cannot process files: AI model is not available.")
        return

    with st.spinner("Engaging AI Core... This may take a moment."):
        all_data = []
        bar = st.progress(0, text="Initializing...")

        for i, f in enumerate(uploaded_files):
            progress_text = f"Processing file {i+1}/{len(uploaded_files)}: {f.name}"
            bar.progress((i) / len(uploaded_files), text=progress_text)
            
            text = extract_pdf_text(f.read())
            if text:
                json_data = get_hierarchical_json(text)
                if json_data:
                    rows = flatten_to_excel_rows(json_data)
                    all_data.extend(rows)
        
        bar.progress(1.0, text="Finalizing data...")

        if all_data:
            df = pd.DataFrame(all_data)
            safe_columns = [c for c in FINAL_COLUMNS if c in df.columns]
            df = df[safe_columns]
            df["Sr. No."] = range(1, len(df) + 1)
            
            st.session_state.df = df
            st.session_state.show_dashboard = True
            st.success(f"Success! Generated {len(df)} rows.")
            time.sleep(1) # Pause for user to see success message
        else:
            st.error("No data could be extracted. Please check the PDF files.")
            st.session_state.show_dashboard = False
    
    st.rerun()

# ==============================================================================
# 6. APP ENTRYPOINT
# ==============================================================================
if __name__ == "__main__":
    main()
