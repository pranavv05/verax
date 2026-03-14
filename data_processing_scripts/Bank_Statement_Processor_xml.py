import pdfplumber
import pandas as pd
import xml.etree.ElementTree as ET
import logging
import argparse
import sys
import re

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

class BankStatementPipeline:
    def __init__(self, pdf_path):
        self.pdf_path = pdf_path
        self.raw_tables = []
        self.df = None

    def extract_tables(self):
        logging.info(f"Extracting tables from {self.pdf_path}")
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                for idx, page in enumerate(pdf.pages):
                    # Extract tables from the page
                    tables = page.extract_tables(table_settings={"vertical_strategy": "text", "horizontal_strategy": "text"})
                    for table in tables:
                        if table:
                            # Clean empty strings and newlines
                            cleaned_table = []
                            for row in table:
                                cleaned_row = [str(cell).replace('\n', ' ').strip() if cell else '' for cell in row]
                                # Only keep rows that are not entirely empty
                                if any(cleaned_row):
                                    cleaned_table.append(cleaned_row)
                            if cleaned_table:
                                self.raw_tables.append(cleaned_table)
                    logging.info(f"Processed page {idx+1}/{len(pdf.pages)} - Found {len(tables)} tables")
        except Exception as e:
            logging.error(f"Failed to read PDF: {e}")
            sys.exit(1)

    def process_tables(self):
        logging.info("Merging and processing tables spanning multiple pages.")
        if not self.raw_tables:
            logging.error("No tables found in the PDF.")
            sys.exit(1)

        # Find the main table shape by assuming the largest column count or the table with recognizable headers
        # We process tables and try to combine them if they have the same number of columns.
        
        merged_data = []
        target_col_count = 0
        
        # Identify the most common column count that is likely our main transaction table
        # Usually, a bank statement has 5-8 columns: Date, Value Date, Narration, Ref, Withdraw, Deposit, Balance
        col_counts = [len(table[0]) for table in self.raw_tables if table]
        if not col_counts:
            logging.error("No valid headers found.")
            sys.exit(1)
            
        target_col_count = max(set(col_counts), key=col_counts.count)
        logging.info(f"Assuming target column count for main table: {target_col_count}")
        
        headers = None
        for table in self.raw_tables:
            # Check if this table matches our target column count
            for row in table:
                if len(row) == target_col_count:
                    if headers is None:
                        row_str = " ".join([str(c).lower() for c in row])
                        if any(k in row_str for k in ['date', 'narration', 'description', 'particulars', 'amount', 'withdrawal', 'deposit', 'balance']):
                            headers = row
                            continue # skip adding header to data
                    merged_data.append(row)
                elif len(row) > target_col_count:
                    # Truncate if more
                    merged_data.append(row[:target_col_count])
                elif len(row) < target_col_count:
                    # Pad if less
                    merged_data.append(row + [''] * (target_col_count - len(row)))

        if not headers:
            headers = [f"Col_{i}" for i in range(target_col_count)]

        self.df = pd.DataFrame(merged_data, columns=headers)
        logging.info(f"Merged table shape: {self.df.shape}")

    def standardize_data(self):
        logging.info("Standardizing data columns.")
        # Try to map columns based on keywords
        col_map = {}
        date_keywords = ['Date', 'txn date', 'transaction date']
        desc_keywords = ['narration', 'description', 'particulars', 'details']
        debit_keywords = ['Withdrawal Amt.', 'debit', 'dr']
        credit_keywords = ['Deposit Amt.', 'credit', 'cr']

        for col in self.df.columns:
            col_lower = str(col).lower().strip()
            col_no_space = col_lower.replace(' ', '')
            if any(k.lower().replace(' ', '') in col_no_space for k in date_keywords) and 'Date' not in col_map.values():
                col_map[col] = 'Date'
            elif any(k.lower().replace(' ', '') in col_no_space for k in desc_keywords) and 'Narration' not in col_map.values():
                col_map[col] = 'Narration'
            elif any(k.lower().replace(' ', '') in col_no_space for k in debit_keywords) and 'Withdrawal Amt.' not in col_map.values():
                col_map[col] = 'Withdrawal Amt.'
            elif any(k.lower().replace(' ', '') in col_no_space for k in credit_keywords) and 'Deposit Amt.' not in col_map.values():
                col_map[col] = 'Deposit Amt.'

        self.df.rename(columns=col_map, inplace=True)
        
        required_cols = ['Date', 'Narration', 'Withdrawal Amt.', 'Deposit Amt.']
        for col in required_cols:
            if col not in self.df.columns:
                logging.warning(f"Required column '{col}' not automatically identified. Creating empty one. Please check data mapping.")
                # fallback heuristics depending on column index could be added, for now add empty
                self.df[col] = ''
                
        # Clean numeric columns
        for col in ['Withdrawal Amt.', 'Deposit Amt.']:
            # Remove commas and convert to float
            self.df[col] = self.df[col].astype(str).str.replace(',', '', regex=False)
            self.df[col] = pd.to_numeric(self.df[col], errors='coerce').fillna(0.0)

        # Clean Date to valid format if possible mapping
        try:
            # Tally likes YYYYMMDD
            self.df['Date_Obj'] = pd.to_datetime(self.df['Date'], errors='coerce', dayfirst=True)
            self.df['Tally_Date'] = self.df['Date_Obj'].dt.strftime('%Y%m%d')
        except Exception:
            logging.error("Failed to parse dates.")
            self.df['Tally_Date'] = ''

        # Filter out rows that are entirely empty or don't have a valid Date
        self.df = self.df.dropna(subset=['Date_Obj'])
        logging.info(f"Shape after standardization and filtering: {self.df.shape}")

    def generate_tally_xml(self, output_xml_path, company_name="My Company", bank_ledger="Bank Ledger"):
        logging.info(f"Generating Tally XML to {output_xml_path}")
        
        envelope = ET.Element("ENVELOPE")
        header = ET.SubElement(envelope, "HEADER")
        ET.SubElement(header, "TALLYREQUEST").text = "Import Data"
        
        body = ET.SubElement(envelope, "BODY")
        importdata = ET.SubElement(body, "IMPORTDATA")
        
        reqdesc = ET.SubElement(importdata, "REQUESTDESC")
        ET.SubElement(reqdesc, "REPORTNAME").text = "Vouchers"
        staticvars = ET.SubElement(reqdesc, "STATICVARIABLES")
        ET.SubElement(staticvars, "SVCURRENTCOMPANY").text = company_name
        
        reqdata = ET.SubElement(importdata, "REQUESTDATA")
        
        for index, row in self.df.iterrows():
            withdrawal = row.get('Withdrawal Amt.', 0.0)
            deposit = row.get('Deposit Amt.', 0.0)
            narration = row.get('Narration', '')
            tally_date = row.get('Tally_Date', '')
            
            if tally_date == '' or (withdrawal == 0 and deposit == 0):
                continue

            vch_type = ""
            amount = 0.0
            is_receipt = False
            
            if deposit > 0:
                vch_type = "Receipt"
                amount = deposit
                is_receipt = True
            elif withdrawal > 0:
                vch_type = "Payment"
                amount = withdrawal
                is_receipt = False

            tallymessage = ET.SubElement(reqdata, "TALLYMESSAGE")
            voucher = ET.SubElement(tallymessage, "VOUCHER", VCHTYPE=vch_type, ACTION="Create")
            
            ET.SubElement(voucher, "DATE").text = str(tally_date)
            ET.SubElement(voucher, "NARRATION").text = str(narration)
            ET.SubElement(voucher, "VOUCHERTYPENAME").text = vch_type
            
            # Create Ledger entries
            
            # The Bank Ledger Entry
            bank_entry = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(bank_entry, "LEDGERNAME").text = bank_ledger
            # In Tally XML amount is negative for Debit (Receipt to Bank) and positive for Credit.
            if is_receipt:
                ET.SubElement(bank_entry, "ISDEEMEDPOSITIVE").text = "Yes"
                ET.SubElement(bank_entry, "AMOUNT").text = f"-{amount:.2f}"
            else:
                ET.SubElement(bank_entry, "ISDEEMEDPOSITIVE").text = "No"
                ET.SubElement(bank_entry, "AMOUNT").text = f"{amount:.2f}"

            # The Suspense/Party Ledger Entry (Counterpart)
            party_entry = ET.SubElement(voucher, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(party_entry, "LEDGERNAME").text = "Suspense A/c" # Placeholder
            if is_receipt:
                ET.SubElement(party_entry, "ISDEEMEDPOSITIVE").text = "No"
                ET.SubElement(party_entry, "AMOUNT").text = f"{amount:.2f}"
            else:
                ET.SubElement(party_entry, "ISDEEMEDPOSITIVE").text = "Yes"
                ET.SubElement(party_entry, "AMOUNT").text = f"-{amount:.2f}"

        # Pretty print and save
        xml_str = ET.tostring(envelope, encoding='utf-8')
        import xml.dom.minidom
        parsed_xml = xml.dom.minidom.parseString(xml_str)
        pretty_xml_as_string = parsed_xml.toprettyxml(indent="  ")
        
        with open(output_xml_path, "w", encoding='utf-8') as f:
            f.write(pretty_xml_as_string)
            
        logging.info("XML generation completed.")

    def run(self, output_xml_path="output.xml"):
        self.extract_tables()
        self.process_tables()
        self.standardize_data()
        self.generate_tally_xml(output_xml_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert Bank Statement PDF to Tally XML")
    parser.add_argument("pdf_path", help="Path to input PDF file")
    parser.add_argument("--output", default="tally_vouchers.xml", help="Output XML file path")
    args = parser.parse_args()

    pipeline = BankStatementPipeline(args.pdf_path)
    pipeline.run(args.output)
