#!/usr/bin/env python3
"""
Verify all participant information in database against Final Data sheet from IDCardData_2.xlsx
"""

import pandas as pd
import pymysql
import os
import json
from urllib.parse import urlparse

# Parse DATABASE_URL
DATABASE_URL = os.environ.get('DATABASE_URL', '')
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found")
    exit(1)

# Parse the URL
parsed = urlparse(DATABASE_URL)
db_config = {
    'host': parsed.hostname,
    'port': parsed.port or 3306,
    'user': parsed.username,
    'password': parsed.password,
    'database': parsed.path.lstrip('/').split('?')[0],
    'ssl_ca': '/etc/ssl/certs/ca-certificates.crt',
    'ssl_verify_cert': True
}

def load_excel_final_data():
    """Load the Final Data sheet from Excel"""
    excel_path = '/home/ubuntu/upload/IDCardData_2.xlsx'
    df = pd.read_excel(excel_path, sheet_name='Final Data')
    print(f"Loaded {len(df)} rows from Final Data sheet")
    print(f"Columns: {list(df.columns)}")
    return df

def load_database_participants():
    """Load all participants from database"""
    conn = pymysql.connect(**db_config)
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    cursor.execute("""
        SELECT id, uuid, name, mobile, qrToken, emergencyContact, 
               photoUri, bloodGroup, age 
        FROM participants 
        ORDER BY qrToken
    """)
    participants = cursor.fetchall()
    cursor.close()
    conn.close()
    print(f"Loaded {len(participants)} participants from database")
    return participants

def extract_badge_number(qr_token):
    """Extract badge number from QR token like PALITANA_YATRA_123"""
    if qr_token and 'PALITANA_YATRA_' in qr_token:
        return int(qr_token.replace('PALITANA_YATRA_', ''))
    return None

def normalize_name(name):
    """Normalize name for comparison"""
    if pd.isna(name) or name is None:
        return ''
    return str(name).strip().lower()

def normalize_phone(phone):
    """Normalize phone number for comparison"""
    if pd.isna(phone) or phone is None:
        return ''
    return str(phone).strip().replace(' ', '').replace('-', '').replace('+91', '')[-10:]

def normalize_blood_group(bg):
    """Normalize blood group for comparison"""
    if pd.isna(bg) or bg is None:
        return ''
    return str(bg).strip().upper().replace(' ', '')

def compare_data(excel_df, db_participants):
    """Compare Excel data with database and find discrepancies"""
    discrepancies = []
    matches = 0
    
    # Create a lookup by badge number for database
    db_by_badge = {}
    for p in db_participants:
        badge = extract_badge_number(p['qrToken'])
        if badge:
            db_by_badge[badge] = p
    
    # Get column names from Excel
    excel_cols = list(excel_df.columns)
    print(f"\nExcel columns: {excel_cols}")
    
    # Map Excel columns to expected fields
    name_col = excel_cols[0]  # Name
    badge_col = excel_cols[1]  # Badge Number
    age_col = excel_cols[2]  # Age
    blood_col = excel_cols[3]  # Blood Group
    emergency_col = excel_cols[4]  # Emergency Contact Number
    photo_col = excel_cols[5] if len(excel_cols) > 5 else None  # Drive Photo Link
    
    print(f"\nMapping: Name={name_col}, Badge={badge_col}, Age={age_col}, Blood={blood_col}, Emergency={emergency_col}")
    
    for idx, row in excel_df.iterrows():
        badge = int(row[badge_col]) if not pd.isna(row[badge_col]) else None
        if badge is None:
            continue
            
        excel_name = str(row[name_col]).strip() if not pd.isna(row[name_col]) else ''
        # Handle age that might be in '16 years' format
        excel_age_raw = row[age_col]
        if pd.isna(excel_age_raw):
            excel_age = None
        else:
            age_str = str(excel_age_raw).strip().lower().replace('years', '').replace('year', '').strip()
            try:
                excel_age = int(float(age_str))
            except:
                excel_age = None
        excel_blood = str(row[blood_col]).strip() if not pd.isna(row[blood_col]) else ''
        excel_emergency = normalize_phone(row[emergency_col])
        excel_photo = str(row[photo_col]).strip() if photo_col and not pd.isna(row[photo_col]) else ''
        
        if badge not in db_by_badge:
            discrepancies.append({
                'badge': badge,
                'issue': 'MISSING_IN_DB',
                'excel_name': excel_name,
                'details': f'Badge #{badge} ({excel_name}) not found in database'
            })
            continue
        
        db_record = db_by_badge[badge]
        db_name = str(db_record['name']).strip() if db_record['name'] else ''
        db_age = db_record['age']
        db_blood = str(db_record['bloodGroup']).strip() if db_record['bloodGroup'] else ''
        db_emergency = normalize_phone(db_record['emergencyContact'])
        db_photo = str(db_record['photoUri']).strip() if db_record['photoUri'] else ''
        
        issues = []
        
        # Compare name (case-insensitive)
        if normalize_name(excel_name) != normalize_name(db_name):
            issues.append(f"Name mismatch: Excel='{excel_name}' vs DB='{db_name}'")
        
        # Compare age
        if excel_age is not None and db_age is not None:
            if excel_age != db_age:
                issues.append(f"Age mismatch: Excel={excel_age} vs DB={db_age}")
        elif excel_age is not None and db_age is None:
            issues.append(f"Age missing in DB: Excel={excel_age}")
        
        # Compare blood group
        if normalize_blood_group(excel_blood) != normalize_blood_group(db_blood):
            if excel_blood:  # Only report if Excel has a value
                issues.append(f"Blood group mismatch: Excel='{excel_blood}' vs DB='{db_blood}'")
        
        # Compare emergency contact
        if excel_emergency != db_emergency:
            if excel_emergency:  # Only report if Excel has a value
                issues.append(f"Emergency contact mismatch: Excel='{excel_emergency}' vs DB='{db_emergency}'")
        
        # Compare photo URI
        if excel_photo and not db_photo:
            issues.append(f"Photo missing in DB: Excel has photo link")
        
        if issues:
            discrepancies.append({
                'badge': badge,
                'issue': 'DATA_MISMATCH',
                'excel_name': excel_name,
                'db_name': db_name,
                'details': '; '.join(issues)
            })
        else:
            matches += 1
    
    return discrepancies, matches

def main():
    print("=" * 60)
    print("FINAL DATA VERIFICATION REPORT")
    print("=" * 60)
    
    # Load data
    excel_df = load_excel_final_data()
    db_participants = load_database_participants()
    
    # Compare
    discrepancies, matches = compare_data(excel_df, db_participants)
    
    print("\n" + "=" * 60)
    print("VERIFICATION RESULTS")
    print("=" * 60)
    print(f"\n✅ Matching records: {matches}")
    print(f"⚠️  Discrepancies found: {len(discrepancies)}")
    
    if discrepancies:
        print("\n" + "-" * 60)
        print("DISCREPANCIES DETAIL:")
        print("-" * 60)
        for d in discrepancies:
            print(f"\nBadge #{d['badge']} - {d['excel_name']}")
            print(f"  Issue: {d['issue']}")
            print(f"  Details: {d['details']}")
    
    # Save report to JSON
    report = {
        'total_excel_records': len(excel_df),
        'total_db_records': len(db_participants),
        'matches': matches,
        'discrepancies_count': len(discrepancies),
        'discrepancies': discrepancies
    }
    
    with open('/home/ubuntu/palirana_yatra/verification_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print("\n" + "=" * 60)
    print(f"Report saved to verification_report.json")
    print("=" * 60)
    
    return discrepancies

if __name__ == '__main__':
    main()
