import os
import csv
import uuid
import shutil
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import shutil
from datetime import datetime

app = Flask(__name__)
# Enable CORS for frontend running on localhost (e.g. Vite default ports 5173, etc.)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
PEOPLE_FILE = os.path.join(DATA_DIR, 'people.csv')
EXPENSES_FILE = os.path.join(DATA_DIR, 'expenses.csv')
SETTLEMENTS_FILE = os.path.join(DATA_DIR, 'settlements.csv')
EXCHANGE_RATES_FILE = os.path.join(DATA_DIR, 'exchange_rates.json')

def init_db():
    """Create data directory and initialize CSV files with headers if they don't exist."""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        
    if not os.path.exists(PEOPLE_FILE):
        with open(PEOPLE_FILE, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['name'])
            
    if not os.path.exists(EXPENSES_FILE):
        with open(EXPENSES_FILE, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'payer', 'amount', 'description', 'split_between', 'splits', 'date'])
    else:
        # Migrate existing expenses file to add 'splits' and 'date' columns if missing
        with open(EXPENSES_FILE, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader, None)
        
        migrated = False
        rows = []
        
        if header:
            with open(EXPENSES_FILE, mode='r', encoding='utf-8') as f:
                reader = csv.reader(f)
                header = next(reader)
                
                splits_idx = -1
                date_idx = -1
                
                if 'splits' not in header:
                    header.append('splits')
                    splits_idx = len(header) - 1
                    migrated = True
                    
                if 'date' not in header:
                    header.append('date')
                    date_idx = len(header) - 1
                    migrated = True
                    
                for row in reader:
                    # Pad row if columns are missing
                    while len(row) < len(header):
                        row.append('')
                    
                    # Fill default values if just added
                    if splits_idx != -1 and not row[splits_idx]:
                        row[splits_idx] = '{}'
                    if date_idx != -1 and not row[date_idx]:
                        row[date_idx] = datetime.now().strftime('%Y-%m-%d')
                    rows.append(row)
                    
            if migrated:
                _backup_file(EXPENSES_FILE)
                with open(EXPENSES_FILE, mode='w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(header)
                    writer.writerows(rows)
            
    if not os.path.exists(SETTLEMENTS_FILE):
        with open(SETTLEMENTS_FILE, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['id', 'debtor', 'creditor', 'amount'])

def _backup_file(src_path):
    if not os.path.exists(src_path):
        return None
    backups_dir = os.path.join(DATA_DIR, 'backups')
    if not os.path.exists(backups_dir):
        os.makedirs(backups_dir)
    ts = datetime.now(datetime.UTC).strftime('%Y-%m-%dT%H%M%SZ')
    base = os.path.basename(src_path)
    dst = os.path.join(backups_dir, f"{base}.{ts}.bak")
    shutil.copy2(src_path, dst)
    return dst

# Ensure a default exchange rates file exists
def ensure_default_rates():
    default = {
        "USD": 285.0,
        "EUR": 310.0,
        "INR": 3.4,
        "PKR": 1.0
    }
    if not os.path.exists(EXCHANGE_RATES_FILE):
        with open(EXCHANGE_RATES_FILE, 'w', encoding='utf-8') as f:
            json.dump(default, f, indent=2)

ensure_default_rates()

init_db()

# --- Currency conversion rates (to PKR) ---
# These are safe defaults; clients can provide a custom `rate` when converting.
RATES_TO_PKR = {
    'PKR': 1.0,
    'USD': 280.0,
    'EUR': 305.0,
    'INR': 3.4,
}

# --- Helper Functions to read/write CSV files ---

def read_people():
    people = []
    with open(PEOPLE_FILE, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('name'):
                people.append(row['name'].strip())
    return people

def write_person(name):
    with open(PEOPLE_FILE, mode='a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([name])

def read_expenses():
    expenses = []
    with open(EXPENSES_FILE, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            split_between = [p.strip() for p in row['split_between'].split(',') if p.strip()]
            splits = {}
            if 'splits' in row and row['splits'].strip():
                import json
                try:
                    splits = json.loads(row['splits'])
                except Exception:
                    splits = {}
            
            date_val = row.get('date', '').strip()
            if not date_val:
                date_val = datetime.now().strftime('%Y-%m-%d')
                
            expenses.append({
                'id': row['id'],
                'payer': row['payer'],
                'amount': round(float(row['amount']), 2),
                'description': row['description'],
                'split_between': split_between,
                'splits': splits,
                'date': date_val
            })
    return expenses

def write_expense(expense_id, payer, amount, description, split_between, splits=None, date=None):
    with open(EXPENSES_FILE, mode='a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        split_str = ",".join(split_between)
        import json
        splits_str = json.dumps(splits) if splits else ""
        if not date:
            date = datetime.now().strftime('%Y-%m-%d')
        writer.writerow([expense_id, payer, amount, description, split_str, splits_str, date])

def rewrite_expenses(expenses):
    _backup_file(EXPENSES_FILE)
    with open(EXPENSES_FILE, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'payer', 'amount', 'description', 'split_between', 'splits', 'date'])
        for exp in expenses:
            split_str = ",".join(exp['split_between'])
            import json
            splits_str = json.dumps(exp['splits']) if exp.get('splits') else ""
            date_val = exp.get('date')
            if not date_val:
                date_val = datetime.now().strftime('%Y-%m-%d')
            writer.writerow([exp['id'], exp['payer'], exp['amount'], exp['description'], split_str, splits_str, date_val])

def read_settlements():
    settlements = []
    with open(SETTLEMENTS_FILE, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            settlements.append({
                'id': row['id'],
                'debtor': row['debtor'],
                'creditor': row['creditor'],
                'amount': round(float(row['amount']), 2)
            })
    return settlements

def write_settlement(settlement_id, debtor, creditor, amount):
    with open(SETTLEMENTS_FILE, mode='a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([settlement_id, debtor, creditor, amount])


# --- API Endpoints ---

@app.route('/people/add', methods=['POST'])
def add_person():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Name field is required'}), 400
        
    name = data['name'].strip()
    if not name:
        return jsonify({'error': 'Name cannot be empty'}), 400
        
    people = read_people()
    # Check duplicate (case-insensitive check for cleanliness)
    if any(p.lower() == name.lower() for p in people):
        return jsonify({'error': f'Person "{name}" already exists'}), 400
        
    write_person(name)
    return jsonify({'message': 'Person added successfully', 'name': name}), 201


@app.route('/people', methods=['GET'])
def get_people():
    try:
        people = read_people()
        return jsonify(people), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/expense/add', methods=['POST'])
def add_expense():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
        
    payer = data.get('payer')
    amount_val = data.get('amount')
    description = data.get('description', '').strip()
    split_between = data.get('split_between')
    splits = data.get('splits') # optional custom splits dict
    date = data.get('date')
    
    if not payer or amount_val is None:
        return jsonify({'error': 'payer and amount are required fields'}), 400
        
    try:
        amount = round(float(amount_val), 2)
    except ValueError:
        return jsonify({'error': 'Amount must be a valid number'}), 400
        
    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than 0'}), 400
        
    people = read_people()
    
    # Validate payer exists
    if payer not in people:
        return jsonify({'error': f'Payer "{payer}" is not registered'}), 400
        
    # Process splits if provided, otherwise equal split
    if splits is not None:
        if not isinstance(splits, dict):
            return jsonify({'error': 'splits must be a dictionary'}), 400
            
        total_split = 0.0
        validated_splits = {}
        for person, split_amount in splits.items():
            if person not in people:
                return jsonify({'error': f'Split member "{person}" in splits is not registered'}), 400
            try:
                val = float(split_amount)
                if val < 0:
                    return jsonify({'error': f'Split amount for "{person}" cannot be negative'}), 400
                total_split += val
                validated_splits[person] = round(val, 2)
            except ValueError:
                return jsonify({'error': f'Split amount for "{person}" must be a valid number'}), 400
                
        # Validate sum matches total
        if abs(total_split - amount) > 0.01:
            return jsonify({'error': f'Sum of splits (${total_split:.2f}) must equal total expense amount (${amount:.2f})'}), 400
            
        splits = validated_splits
        # If splits are provided, split_between is the participants (people with splits > 0)
        split_between = [p for p, val in splits.items() if val > 0]
    else:
        # splits is None, use equal split
        if not split_between or not isinstance(split_between, list) or len(split_between) == 0:
            return jsonify({'error': 'split_between must be a non-empty list of names when custom splits are not provided'}), 400
            
        # Validate split members exist
        for person in split_between:
            if person not in people:
                return jsonify({'error': f'Split member "{person}" is not registered'}), 400
        splits = {}
        
    if not date:
        date = datetime.now().strftime('%Y-%m-%d')
        
    expense_id = uuid.uuid4().hex
    write_expense(expense_id, payer, amount, description, split_between, splits, date)
    return jsonify({
        'message': 'Expense added successfully', 
        'expense': {
            'id': expense_id,
            'payer': payer,
            'amount': amount,
            'description': description,
            'split_between': split_between,
            'splits': splits,
            'date': date
        }
    }), 201


@app.route('/expense/<string:expense_id>', methods=['PUT'])
def edit_expense(expense_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
        
    payer = data.get('payer')
    amount_val = data.get('amount')
    description = data.get('description', '').strip()
    split_between = data.get('split_between')
    splits = data.get('splits')
    date = data.get('date')
    
    if not payer or amount_val is None:
        return jsonify({'error': 'payer and amount are required fields'}), 400
        
    try:
        amount = round(float(amount_val), 2)
    except ValueError:
        return jsonify({'error': 'Amount must be a valid number'}), 400
        
    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than 0'}), 400
        
    people = read_people()
    if payer not in people:
        return jsonify({'error': f'Payer "{payer}" is not registered'}), 400
        
    # Process splits if provided, otherwise equal split
    if splits is not None:
        if not isinstance(splits, dict):
            return jsonify({'error': 'splits must be a dictionary'}), 400
            
        total_split = 0.0
        validated_splits = {}
        for person, split_amount in splits.items():
            if person not in people:
                return jsonify({'error': f'Split member "{person}" in splits is not registered'}), 400
            try:
                val = float(split_amount)
                if val < 0:
                    return jsonify({'error': f'Split amount for "{person}" cannot be negative'}), 400
                total_split += val
                validated_splits[person] = round(val, 2)
            except ValueError:
                return jsonify({'error': f'Split amount for "{person}" must be a valid number'}), 400
                
        if abs(total_split - amount) > 0.01:
            return jsonify({'error': f'Sum of splits (${total_split:.2f}) must equal total expense amount (${amount:.2f})'}), 400
            
        splits = validated_splits
        split_between = [p for p, val in splits.items() if val > 0]
    else:
        if not split_between or not isinstance(split_between, list) or len(split_between) == 0:
            return jsonify({'error': 'split_between must be a non-empty list of names when custom splits are not provided'}), 400
            
        for person in split_between:
            if person not in people:
                return jsonify({'error': f'Split member "{person}" is not registered'}), 400
        splits = {}
        
    if not date:
        date = datetime.now().strftime('%Y-%m-%d')
        
    expenses = read_expenses()
    found = False
    for exp in expenses:
        if exp['id'] == expense_id:
            exp['payer'] = payer
            exp['amount'] = amount
            exp['description'] = description
            exp['split_between'] = split_between
            exp['splits'] = splits
            exp['date'] = date
            found = True
            break
            
    if not found:
        return jsonify({'error': 'Expense not found'}), 404
        
    rewrite_expenses(expenses)
    return jsonify({'message': 'Expense updated successfully'}), 200


@app.route('/expense/<string:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    try:
        expenses = read_expenses()
        initial_len = len(expenses)
        expenses = [exp for exp in expenses if exp['id'] != expense_id]
        
        if len(expenses) == initial_len:
            return jsonify({'error': 'Expense not found'}), 404
            
        rewrite_expenses(expenses)
        return jsonify({'message': 'Expense deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/expenses', methods=['GET'])
def get_expenses():
    try:
        expenses = read_expenses()
        return jsonify(expenses), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/balances', methods=['GET'])
def get_balances():
    try:
        people = read_people()
        expenses = read_expenses()
        settlements = read_settlements()
        
        # Initialize net balances
        balances = {person: 0.0 for person in people}
        
        # Apply expenses
        for expense in expenses:
            payer = expense['payer']
            amount = expense['amount']
            split_between = expense['split_between']
            splits = expense.get('splits', {})
            
            if payer in balances:
                balances[payer] += amount
                
            if splits:
                # Apply custom splits
                for person, split_amount in splits.items():
                    if person in balances:
                        balances[person] -= float(split_amount)
            else:
                # Apply equal split fallback
                if not split_between:
                    continue
                split_amount = amount / len(split_between)
                for person in split_between:
                    if person in balances:
                        balances[person] -= split_amount
                    
        # Apply settlements
        for settlement in settlements:
            debtor = settlement['debtor']
            creditor = settlement['creditor']
            amount = settlement['amount']
            
            if debtor in balances:
                balances[debtor] += amount
            if creditor in balances:
                balances[creditor] -= amount
                
        # Resolve balances into simplified debts
        debts = []
        creditors = sorted([[p, bal] for p, bal in balances.items() if bal > 0.005], key=lambda x: x[1], reverse=True)
        debtors = sorted([[p, -bal] for p, bal in balances.items() if bal < -0.005], key=lambda x: x[1], reverse=True)
        
        c_idx = 0
        d_idx = 0
        
        while c_idx < len(creditors) and d_idx < len(debtors):
            creditor, c_bal = creditors[c_idx]
            debtor, d_bal = debtors[d_idx]
            
            settled_amount = min(c_bal, d_bal)
            settled_amount = round(settled_amount, 2)
            
            if settled_amount > 0:
                debts.append({
                    'from': debtor,
                    'to': creditor,
                    'amount': settled_amount
                })
                
            creditors[c_idx][1] -= settled_amount
            debtors[d_idx][1] -= settled_amount
            
            # Move pointers when balance is resolved
            if creditors[c_idx][1] < 0.005:
                c_idx += 1
            if debtors[d_idx][1] < 0.005:
                d_idx += 1
                
        # Also return individual net balances for detail views if needed
        # rounded to 2 decimal places
        individual_balances = {p: round(bal, 2) for p, bal in balances.items()}
        
        return jsonify({
            'debts': debts,
            'balances': individual_balances,
            'settlements': settlements
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/settle', methods=['POST'])
def settle_debt():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
        
    debtor = data.get('debtor')
    creditor = data.get('creditor')
    amount_val = data.get('amount')
    
    if not debtor or not creditor or amount_val is None:
        return jsonify({'error': 'debtor, creditor, and amount are required fields'}), 400
        
    if debtor == creditor:
        return jsonify({'error': 'Cannot settle debt with oneself'}), 400
        
    try:
        amount = round(float(amount_val), 2)
    except ValueError:
        return jsonify({'error': 'Amount must be a valid number'}), 400
        
    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than 0'}), 400
        
    people = read_people()
    if debtor not in people:
        return jsonify({'error': f'Debtor "{debtor}" is not registered'}), 400
    if creditor not in people:
        return jsonify({'error': f'Creditor "{creditor}" is not registered'}), 400
        
    settlement_id = uuid.uuid4().hex
    write_settlement(settlement_id, debtor, creditor, amount)
    
    return jsonify({
        'message': 'Settlement recorded successfully',
        'settlement': {
            'id': settlement_id,
            'debtor': debtor,
            'creditor': creditor,
            'amount': amount
        }
    }), 201


# --- Currency conversion API ---
@app.route('/rates', methods=['GET'])
def get_rates():
    """Return the current stored exchange rates (to PKR)."""
    try:
        if os.path.exists(EXCHANGE_RATES_FILE):
            with open(EXCHANGE_RATES_FILE, 'r', encoding='utf-8') as f:
                rates = json.load(f)
        else:
            rates = RATES_TO_PKR
        return jsonify(rates), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/convert', methods=['POST'])
def convert_to_pkr():
    """Convert an amount from a source currency to PKR.

    Accepts JSON: { "amount": 10.5, "from": "USD", "rate": optional_custom_rate }
    """
    data = request.get_json() or {}
    try:
        amount = float(data.get('amount', 0))
    except Exception:
        return jsonify({'error': 'Invalid amount'}), 400

    src = (data.get('from') or 'PKR').upper()
    custom_rate = data.get('rate')

    # prefer explicit custom rate, otherwise look up stored rates
    if custom_rate is not None:
        try:
            rate = float(custom_rate)
        except Exception:
            return jsonify({'error': 'Invalid custom rate'}), 400
    else:
        # try file-based rates, then fallback to in-code defaults
        if os.path.exists(EXCHANGE_RATES_FILE):
            with open(EXCHANGE_RATES_FILE, 'r', encoding='utf-8') as f:
                rates = json.load(f)
            rate = rates.get(src) or RATES_TO_PKR.get(src)
        else:
            rate = RATES_TO_PKR.get(src)

    if rate is None:
        return jsonify({'error': f'Unsupported source currency: {src}'}), 400

    pkr_value = round(amount * float(rate), 2)
    return jsonify({'amount': amount, 'from': src, 'rate': float(rate), 'pkr': pkr_value}), 200


@app.route('/convert/data', methods=['POST'])
def convert_and_store():
    """Convert existing stored expenses/settlements from a given currency into PKR.

    Body: { "file": "expenses"|"settlements", "from": "USD", "rate": optional }
    This will back up the target CSV then rewrite amounts to their PKR equivalents.
    """
    data = request.get_json() or {}
    target = data.get('file')
    src = (data.get('from') or 'PKR').upper()
    custom_rate = data.get('rate')

    if target not in ('expenses', 'settlements'):
        return jsonify({'error': 'file must be "expenses" or "settlements"'}), 400

    # Resolve rate
    if custom_rate is not None:
        try:
            rate = float(custom_rate)
        except Exception:
            return jsonify({'error': 'Invalid custom rate'}), 400
    else:
        if os.path.exists(EXCHANGE_RATES_FILE):
            with open(EXCHANGE_RATES_FILE, 'r', encoding='utf-8') as f:
                rates = json.load(f)
            rate = rates.get(src) or RATES_TO_PKR.get(src)
        else:
            rate = RATES_TO_PKR.get(src)

    if rate is None:
        return jsonify({'error': f'Unsupported source currency: {src}'}), 400

    # Pick file
    if target == 'expenses':
        path = EXPENSES_FILE
        # backup
        _backup_file(path)
        rows = []
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames
            for row in reader:
                try:
                    row['amount'] = str(round(float(row.get('amount', 0)) * float(rate), 2))
                except Exception:
                    pass
                rows.append(row)
        # write back
        with open(path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=header)
            writer.writeheader()
            writer.writerows(rows)

    else:
        path = SETTLEMENTS_FILE
        _backup_file(path)
        rows = []
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            header = reader.fieldnames
            for row in reader:
                try:
                    row['amount'] = str(round(float(row.get('amount', 0)) * float(rate), 2))
                except Exception:
                    pass
                rows.append(row)
        with open(path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=header)
            writer.writeheader()
            writer.writerows(rows)

    return jsonify({'message': f'{target} converted to PKR using rate {rate} (1 {src} = {rate} PKR)'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
