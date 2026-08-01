import sys
sys.path.append('e:/MyProjects/fieldOps/backend')
from app.db.database import engine
from sqlalchemy import inspect

inspector = inspect(engine)

print('DATABASE SCHEMA:')
for table_name in inspector.get_table_names():
    print(f'\nTable: {table_name}')
    print('-' * 40)
    for column in inspector.get_columns(table_name):
        print(f'  - {column["name"]}: {column["type"]} (nullable: {column["nullable"]})')
