#!/usr/bin/env python3
"""
Comprehensive verification of all 417 participants - QR codes and data accuracy
"""

import pandas as pd
import pymysql
import os
import json
from urllib.parse import urlparse
from pathlib import Path

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
    return participants

def extract_badge_number(qr_token):
    """Extract badge number from QR token like PALITANA_YATRA_123"""
    if qr_token and 'PALITANA_YATRA_' in qr_token:
        return int(qr_token.replace('PALITANA_YATRA_', ''))
    return None

def verify_qr_code_files():
    """Verify QR code files exist for all participants"""
    qr_dir = Path('./qr_codes_uploaded/qr_codes_v2')
    if not qr_dir.exists():
        return None, "QR codes directory not found"
    
    qr_files = list(qr_dir.glob('*.png'))
    file_badges = []
    for f in qr_files:
        parts = f.name.split('_')
        if parts and parts[0].isdigit():
            file_badges.append(int(parts[0]))
    
    return sorted(file_badges), None

def main():
    print("=" * 70)
    print("COMPREHENSIVE PARTICIPANT VERIFICATION REPORT")
    print("=" * 70)
    
    # Load participants from database
    participants = load_database_participants()
    print(f"\n📊 Total participants in database: {len(participants)}")
    
    # Create lookup by badge number
    by_badge = {}
    for p in participants:
        badge = extract_badge_number(p['qrToken'])
        if badge:
            by_badge[badge] = p
    
    # Verify all 417 badge numbers exist
    print("\n" + "-" * 70)
    print("1. BADGE NUMBER VERIFICATION")
    print("-" * 70)
    
    missing_badges = []
    for i in range(1, 418):
        if i not in by_badge:
            missing_badges.append(i)
    
    if missing_badges:
        print(f"❌ Missing badge numbers: {missing_badges}")
    else:
        print("✅ All 417 badge numbers (1-417) present in database")
    
    # Verify QR code files
    print("\n" + "-" * 70)
    print("2. QR CODE FILE VERIFICATION")
    print("-" * 70)
    
    file_badges, error = verify_qr_code_files()
    if error:
        print(f"⚠️  {error}")
    else:
        missing_files = [i for i in range(1, 418) if i not in file_badges]
        if missing_files:
            print(f"❌ Missing QR code files for badges: {missing_files}")
        else:
            print(f"✅ All 417 QR code files present ({len(file_badges)} files)")
    
    # Verify data completeness for each participant
    print("\n" + "-" * 70)
    print("3. DATA COMPLETENESS VERIFICATION")
    print("-" * 70)
    
    incomplete = []
    for badge in range(1, 418):
        if badge not in by_badge:
            continue
        p = by_badge[badge]
        missing_fields = []
        
        if not p['name'] or str(p['name']).strip() == '':
            missing_fields.append('name')
        if not p['uuid']:
            missing_fields.append('uuid')
        if not p['qrToken']:
            missing_fields.append('qrToken')
        
        if missing_fields:
            incomplete.append((badge, p['name'], missing_fields))
    
    if incomplete:
        print("❌ Participants with missing critical data:")
        for badge, name, fields in incomplete:
            print(f"   Badge #{badge} ({name}): missing {', '.join(fields)}")
    else:
        print("✅ All participants have complete critical data (name, uuid, qrToken)")
    
    # Verify data validity
    print("\n" + "-" * 70)
    print("4. DATA VALIDITY VERIFICATION")
    print("-" * 70)
    
    invalid = []
    for badge in range(1, 418):
        if badge not in by_badge:
            continue
        p = by_badge[badge]
        issues = []
        
        # Check UUID format
        uuid = p['uuid']
        if not uuid or len(uuid) != 36 or uuid.count('-') != 4:
            issues.append(f"invalid UUID: {uuid}")
        
        # Check QR token format
        expected_token = f"PALITANA_YATRA_{badge}"
        if p['qrToken'] != expected_token:
            issues.append(f"wrong qrToken: expected {expected_token}, got {p['qrToken']}")
        
        # Check age if present
        if p['age'] is not None:
            try:
                age = int(p['age'])
                if age < 1 or age > 120:
                    issues.append(f"invalid age: {age}")
            except:
                issues.append(f"non-numeric age: {p['age']}")
        
        if issues:
            invalid.append((badge, p['name'], issues))
    
    if invalid:
        print("❌ Participants with invalid data:")
        for badge, name, issues in invalid:
            print(f"   Badge #{badge} ({name}): {', '.join(issues)}")
    else:
        print("✅ All participants have valid data formats")
    
    # Print sample participants
    print("\n" + "-" * 70)
    print("5. SAMPLE PARTICIPANT DETAILS (First 5 and Last 5)")
    print("-" * 70)
    
    print("\n📋 First 5 Participants:")
    for badge in range(1, 6):
        if badge in by_badge:
            p = by_badge[badge]
            print(f"\n   Badge #{badge}: {p['name']}")
            print(f"      UUID: {p['uuid'][:8]}...{p['uuid'][-4:]}")
            print(f"      QR Token: {p['qrToken']}")
            print(f"      Mobile: {p['mobile'] or 'N/A'}")
            print(f"      Emergency: {p['emergencyContact'] or 'N/A'}")
            print(f"      Blood Group: {p['bloodGroup'] or 'N/A'}")
            print(f"      Age: {p['age'] or 'N/A'}")
            print(f"      Photo: {'✓' if p['photoUri'] else 'N/A'}")
    
    print("\n📋 Last 5 Participants:")
    for badge in range(413, 418):
        if badge in by_badge:
            p = by_badge[badge]
            print(f"\n   Badge #{badge}: {p['name']}")
            print(f"      UUID: {p['uuid'][:8]}...{p['uuid'][-4:]}")
            print(f"      QR Token: {p['qrToken']}")
            print(f"      Mobile: {p['mobile'] or 'N/A'}")
            print(f"      Emergency: {p['emergencyContact'] or 'N/A'}")
            print(f"      Blood Group: {p['bloodGroup'] or 'N/A'}")
            print(f"      Age: {p['age'] or 'N/A'}")
            print(f"      Photo: {'✓' if p['photoUri'] else 'N/A'}")
    
    # Summary
    print("\n" + "=" * 70)
    print("VERIFICATION SUMMARY")
    print("=" * 70)
    
    all_passed = True
    
    if missing_badges:
        print(f"❌ Badge Numbers: {len(missing_badges)} missing")
        all_passed = False
    else:
        print("✅ Badge Numbers: All 417 present")
    
    if file_badges and len([i for i in range(1, 418) if i not in file_badges]) == 0:
        print("✅ QR Code Files: All 417 present")
    elif file_badges:
        print(f"❌ QR Code Files: Some missing")
        all_passed = False
    
    if incomplete:
        print(f"❌ Data Completeness: {len(incomplete)} incomplete")
        all_passed = False
    else:
        print("✅ Data Completeness: All complete")
    
    if invalid:
        print(f"❌ Data Validity: {len(invalid)} invalid")
        all_passed = False
    else:
        print("✅ Data Validity: All valid")
    
    print("\n" + "=" * 70)
    if all_passed:
        print("🎉 ALL VERIFICATIONS PASSED - 417 PARTICIPANTS VERIFIED")
    else:
        print("⚠️  SOME VERIFICATIONS FAILED - REVIEW ABOVE DETAILS")
    print("=" * 70)
    
    # Save detailed report
    report = {
        'total_participants': len(participants),
        'missing_badges': missing_badges,
        'incomplete_data': [(b, n, f) for b, n, f in incomplete],
        'invalid_data': [(b, n, i) for b, n, i in invalid],
        'all_passed': all_passed
    }
    
    with open('participant_verification_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nDetailed report saved to: participant_verification_report.json")

if __name__ == '__main__':
    main()
