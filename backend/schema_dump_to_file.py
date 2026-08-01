import sys
sys.path.append('e:/MyProjects/fieldOps/backend')
from app.db.database import engine
from sqlalchemy import inspect

inspector = inspect(engine)

with open('full_schema.md', 'w') as f:
    f.write('DATABASE SCHEMA:\n')
    for table_name in inspector.get_table_names():
        f.write(f'\nTable: {table_name}\n')
        f.write('-' * 40 + '\n')
        for column in inspector.get_columns(table_name):
            f.write(f'  - {column["name"]}: {column["type"]} (nullable: {column["nullable"]})\n')
