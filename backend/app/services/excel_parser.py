import pandas as pd

def parse_excel(file):
    # Logic to parse excel file
    xls = pd.ExcelFile(file)
    sheets = {}
    for sheet_name in xls.sheet_names:
        sheets[sheet_name] = xls.parse(sheet_name)
    return sheets
