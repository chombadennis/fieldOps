import sqlite3

try:
    conn = sqlite3.connect('e:/MyProjects/fieldOps/backend/fieldops.db')
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE milestone_claim_documents ADD COLUMN claim_number VARCHAR")
    cursor.execute("CREATE INDEX ix_milestone_claim_documents_claim_number ON milestone_claim_documents(claim_number)")
    conn.commit()
    print("Successfully added claim_number column and index.")
except sqlite3.OperationalError as e:
    print(f"Error (maybe column already exists): {e}")
finally:
    conn.close()
