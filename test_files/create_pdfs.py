import sys
import os

# Append the Python user base bin directory to path just in case
sys.path.append(os.path.join(os.environ.get('APPDATA', ''), r'..\Roaming\Python\Python311\site-packages'))

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

def create_valid_boq():
    c = canvas.Canvas("test_valid_boq.pdf", pagesize=A4)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1 * inch, 10.5 * inch, "BILL OF QUANTITIES")
    
    c.setFont("Helvetica", 12)
    c.drawString(1 * inch, 9.5 * inch, "PROJECT: OFFICE BLOCK B")
    c.drawString(1 * inch, 9.2 * inch, "CLIENT: FIELD OPS LTD")
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, 8.5 * inch, "ELEMENT NO. 1 - SUBSTRUCTURES")
    
    # Headers
    c.setFont("Helvetica-Bold", 10)
    c.drawString(1 * inch, 8.0 * inch, "Item")
    c.drawString(1.5 * inch, 8.0 * inch, "Description")
    c.drawString(4.5 * inch, 8.0 * inch, "Unit")
    c.drawString(5.2 * inch, 8.0 * inch, "Qty")
    c.drawString(6.0 * inch, 8.0 * inch, "Rate")
    c.drawString(7.0 * inch, 8.0 * inch, "Amount")
    
    # Items
    c.setFont("Helvetica", 10)
    
    y = 7.5
    items = [
        ("A", "Clear site of all bushes, scrubs and undergrowth", "sm", "1500", "50", "75,000"),
        ("B", "Excavate oversite to reduce levels", "cm", "450", "300", "135,000"),
        ("C", "Mass concrete in foundation footings", "cm", "25", "12000", "300,000"),
        ("D", "Reinforced concrete columns", "cm", "15", "18000", "270,000")
    ]
    
    for item in items:
        c.drawString(1 * inch, y * inch, item[0])
        c.drawString(1.5 * inch, y * inch, item[1])
        c.drawString(4.5 * inch, y * inch, item[2])
        c.drawString(5.2 * inch, y * inch, item[3])
        c.drawString(6.0 * inch, y * inch, item[4])
        c.drawString(7.0 * inch, y * inch, item[5])
        y -= 0.5

    c.save()
    print("Created test_valid_boq.pdf")

def create_invalid_invoice():
    c = canvas.Canvas("test_invalid_invoice.pdf", pagesize=A4)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(1 * inch, 10.5 * inch, "VENDOR INVOICE")
    
    c.setFont("Helvetica", 12)
    c.drawString(1 * inch, 9.5 * inch, "FROM: ACME CEMENT SUPPLIERS")
    c.drawString(1 * inch, 9.2 * inch, "TO: FIELD OPS LTD")
    c.drawString(1 * inch, 8.9 * inch, "DATE: 28 AUG 2026")
    c.drawString(1 * inch, 8.6 * inch, "INVOICE #: INV-2026-0899")
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, 7.5 * inch, "Please pay the following amount:")
    
    c.setFont("Helvetica", 12)
    c.drawString(1 * inch, 7.0 * inch, "Description: 500 Bags of Portland Cement")
    c.drawString(1 * inch, 6.5 * inch, "Total Amount Due: $4,500.00")
    
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(1 * inch, 5.5 * inch, "Thank you for your business.")
    c.save()
    print("Created test_invalid_invoice.pdf")

if __name__ == "__main__":
    create_valid_boq()
    create_invalid_invoice()
