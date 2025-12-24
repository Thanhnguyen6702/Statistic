"""
Application configuration classes.
"""

import os


def get_database_uri():
    """Get database URI with proper SSL settings for PostgreSQL."""
    uri = os.environ.get('DATABASE_URL')
    if uri:
        # Fix for Heroku/Render PostgreSQL URLs
        if uri.startswith('postgres://'):
            uri = uri.replace('postgres://', 'postgresql://', 1)
        # Add sslmode if not present for remote PostgreSQL
        if 'sslmode' not in uri and 'postgresql' in uri and 'localhost' not in uri:
            separator = '&' if '?' in uri else '?'
            uri += f'{separator}sslmode=require'
        return uri
    return None


class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD') or 'admin123'


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    # Use Neon PostgreSQL for both local and remote
    SQLALCHEMY_DATABASE_URI = get_database_uri() or 'postgresql://neondb_owner:npg_ecS9tXY0CNBF@ep-raspy-grass-a1rz3c2w-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = get_database_uri()


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
