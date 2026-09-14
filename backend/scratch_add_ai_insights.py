import sqlite3

try:
    conn = sqlite3.connect('e:/MyProjects/fieldOps/backend/fieldops.db')
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE documents ADD COLUMN ai_insights TEXT")
    conn.commit()
    print("Successfully added ai_insights column to documents table.")
except sqlite3.OperationalError as e:
    print(f"Error (maybe column already exists): {e}")
finally:
    conn.close()
