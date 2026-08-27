import sqlite3
import json

def check_db():
    conn = sqlite3.connect('e:\\MyProjects\\fieldOps\\backend\\fieldops.db')
    cursor = conn.cursor()
    cursor.execute("SELECT id, project_id, amount, revised_amount, values_map FROM budgets ORDER BY id DESC LIMIT 5")
    rows = cursor.fetchall()
    
    if not rows:
        print("No budgets found.")
        return

    for row in rows:
        b_id, p_id, amount, revised, v_map = row
        print(f"Budget ID: {b_id}, Project ID: {p_id}")
        if v_map:
            try:
                v_map_dict = json.loads(v_map)
                table = v_map_dict.get("master_cleaned_table", {})
                appraised = table.get("appraised_budget", 0)
                ev = table.get("earned_value", 0)
                remaining = table.get("remaining_balance", 0)
                print(f"  Appraised Master Budget: ${appraised:,.2f}")
                print(f"  Earned Value to Date:    ${ev:,.2f}")
                print(f"  Remaining Balance saved: ${remaining:,.2f}")
                print(f"  Actual Difference:       ${(appraised or 0) - (ev or 0):,.2f}")
            except Exception as e:
                print("  Could not parse values_map:", e)
        else:
            print("  No values_map.")
        print("-" * 40)
    conn.close()

if __name__ == "__main__":
    check_db()
