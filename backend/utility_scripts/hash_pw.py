"""
This script creates a hashed password for a given plain text password.
The intention is to make it easier to create new users with hashed passwords in
the database.

Usage: python hash_pw.py <password>

"""

import sys

from app.models.user import User


def main():
    if len(sys.argv) != 2:
        print("Usage: python hash_pw.py <password>")
        sys.exit(1)

    password = sys.argv[1]
    hashed_pw = User.hash_password(password)
    print(f"Password: {password}")
    print(f"Hashed: {hashed_pw}")


if __name__ == "__main__":
    main()
