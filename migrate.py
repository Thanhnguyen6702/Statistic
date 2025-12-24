"""
Migration script to add participants column to expense table.
Run this script once after updating the codebase.
"""

from sqlalchemy import inspect, text
from app import create_app
from app.extensions import db


def migrate():
    app = create_app()

    with app.app_context():
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('expense')]

        if 'participants' not in columns:
            print('Adding participants column to expense table...')
            db.session.execute(text('ALTER TABLE expense ADD COLUMN participants TEXT'))
            db.session.commit()
            print('Migration completed successfully!')
        else:
            print('Column participants already exists. No migration needed.')


if __name__ == '__main__':
    migrate()
