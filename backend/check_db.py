
import sqlite3
import os

db_path = 'e:/MyProjects/fieldOps/backend/fieldops.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute('SELECT name FROM sqlite_master WHERE type=\'table\';')
    tables = [r[0] for r in cur.fetchall()]
    
    if 'documents' in tables:
        cur.execute('SELECT id, name, origin, file_url, is_linked FROM documents WHERE name LIKE \'%structural%\';')
        rows = cur.fetchall()
        print('documents table:', rows)
    if 'field_ops' in tables:
        cur.execute('SELECT id, name, origin, file_url, is_linked FROM field_ops WHERE name LIKE \'%structural%\';')
        rows = cur.fetchall()
        print('field_ops table:', rows)
else:
    print('DB not found at', db_path)

