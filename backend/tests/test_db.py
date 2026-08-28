import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.budget import Budget
import json

def test_db():
    db = SessionLocal()
    budgets = db.query(Budget).order_by(Budget.id.desc()).limit(5).all()
    
    if not budgets:
        print("No budgets found.")
        return

    for budget in budgets:
        print(f"Budget ID: {budget.id}, Project ID: {budget.project_id}")
        if budget.values_map and "master_cleaned_table" in budget.values_map:
            table = budget.values_map["master_cleaned_table"]
            appraised = table.get("appraised_budget", 0)
            ev = table.get("earned_value", 0)
            remaining = table.get("remaining_balance", 0)
            print(f"  Appraised Master Budget: ${appraised:,.2f}")
            print(f"  Earned Value to Date:    ${ev:,.2f}")
            print(f"  Remaining Balance saved: ${remaining:,.2f}")
            print(f"  Actual Difference:       ${(appraised or 0) - (ev or 0):,.2f}")
        else:
            print("  No master_cleaned_table in values_map.")
        print("-" * 40)
    db.close()

if __name__ == "__main__":
    test_db()
