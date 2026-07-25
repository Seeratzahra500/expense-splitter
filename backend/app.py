import os
import csv
import uuid
import json
from datetime import datetime

from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import create_engine, Column, String, Float, Text
from sqlalchemy.orm import declarative_base, sessionmaker

# ── App & CORS ────────────────────────────────────────────────────────────────
app = Flask(__name__)
# In production set FRONTEND_ORIGIN to your Vercel URL to lock CORS down.
# Comma-separated origins are supported; defaults to "*" for local dev.
_origins = os.environ.get('FRONTEND_ORIGIN', '*')
CORS(app, origins=[o.strip() for o in _origins.split(',')] if _origins != '*' else '*')

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(DATA_DIR, exist_ok=True)
EXCHANGE_RATES_FILE = os.path.join(DATA_DIR, 'exchange_rates.json')

# Legacy CSV paths — only read once, to migrate old data into the database.
PEOPLE_CSV = os.path.join(DATA_DIR, 'people.csv')
EXPENSES_CSV = os.path.join(DATA_DIR, 'expenses.csv')
SETTLEMENTS_CSV = os.path.join(DATA_DIR, 'settlements.csv')

# ── Database setup ────────────────────────────────────────────────────────────
def _database_url():
    """Postgres in production (via DATABASE_URL), SQLite file for local dev."""
    url = os.environ.get('DATABASE_URL')
    if not url:
        return 'sqlite:///' + os.path.join(DATA_DIR, 'expense.db')
    # Render/Heroku hand out `postgres://`; SQLAlchemy needs `postgresql://`.
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    return url

ENGINE = create_engine(_database_url(), future=True, pool_pre_ping=True)
Session = sessionmaker(bind=ENGINE, future=True)
Base = declarative_base()


class Person(Base):
    __tablename__ = 'people'
    name = Column(String, primary_key=True)


class Expense(Base):
    __tablename__ = 'expenses'
    id = Column(String, primary_key=True)
    payer = Column(String, nullable=False)
    amount = Column(Float, nullable=False)          # always stored in PKR
    description = Column(Text, default='')
    split_between = Column(Text, default='')        # comma-separated names
    splits = Column(Text, default='')               # JSON dict, or '' for equal split
    date = Column(String, default='')               # YYYY-MM-DD


class Settlement(Base):
    __tablename__ = 'settlements'
    id = Column(String, primary_key=True)
    debtor = Column(String, nullable=False)
    creditor = Column(String, nullable=False)
    amount = Column(Float, nullable=False)          # PKR


Base.metadata.create_all(ENGINE)

# --- Currency conversion rates (to PKR) ---
# Single source of truth for default rates. Clients can supply a custom `rate`
# per request, or edit data/exchange_rates.json to override these persistently.
RATES_TO_PKR = {
    'PKR': 1.0,
    'USD': 285.0,
    'EUR': 310.0,
    'INR': 3.4,
}


def ensure_default_rates():
    """Seed the rates file from RATES_TO_PKR so file and fallback never diverge."""
    if not os.path.exists(EXCHANGE_RATES_FILE):
        with open(EXCHANGE_RATES_FILE, 'w', encoding='utf-8') as f:
            json.dump(RATES_TO_PKR, f, indent=2)


def migrate_csv_if_present():
    """One-time import of legacy CSV data into an empty database.

    Runs only when the people table is empty and old CSV files exist, so it is
    safe to call on every startup. Lets existing local data survive the switch.
    """
    with Session() as s:
        if s.query(Person).first() is not None:
            return  # DB already has data; nothing to migrate
        if not os.path.exists(PEOPLE_CSV):
            return

        imported = False
        with open(PEOPLE_CSV, newline='', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                name = (row.get('name') or '').strip()
                if name and not s.get(Person, name):
                    s.add(Person(name=name))
                    imported = True

        if os.path.exists(EXPENSES_CSV):
            with open(EXPENSES_CSV, newline='', encoding='utf-8') as f:
                for row in csv.DictReader(f):
                    try:
                        s.add(Expense(
                            id=row.get('id') or uuid.uuid4().hex,
                            payer=row.get('payer', ''),
                            amount=round(float(row.get('amount', 0) or 0), 2),
                            description=row.get('description', ''),
                            split_between=row.get('split_between', ''),
                            splits=row.get('splits', '') or '',
                            date=row.get('date', '') or datetime.now().strftime('%Y-%m-%d'),
                        ))
                        imported = True
                    except (ValueError, TypeError):
                        continue

        if os.path.exists(SETTLEMENTS_CSV):
            with open(SETTLEMENTS_CSV, newline='', encoding='utf-8') as f:
                for row in csv.DictReader(f):
                    try:
                        s.add(Settlement(
                            id=row.get('id') or uuid.uuid4().hex,
                            debtor=row.get('debtor', ''),
                            creditor=row.get('creditor', ''),
                            amount=round(float(row.get('amount', 0) or 0), 2),
                        ))
                        imported = True
                    except (ValueError, TypeError):
                        continue

        if imported:
            s.commit()


ensure_default_rates()
migrate_csv_if_present()

# --- Helper Functions (database-backed; return the same shapes as before) ---


def read_people():
    with Session() as s:
        return [p.name for p in s.query(Person).order_by(Person.name).all()]


def write_person(name):
    with Session() as s:
        s.add(Person(name=name))
        s.commit()


def _expense_to_dict(e):
    split_between = [p.strip() for p in (e.split_between or '').split(',') if p.strip()]
    splits = {}
    if e.splits:
        try:
            splits = json.loads(e.splits)
        except Exception:
            splits = {}
    date_val = (e.date or '').strip() or datetime.now().strftime('%Y-%m-%d')
    return {
        'id': e.id,
        'payer': e.payer,
        'amount': round(float(e.amount), 2),
        'description': e.description or '',
        'split_between': split_between,
        'splits': splits,
        'date': date_val,
    }


def read_expenses():
    with Session() as s:
        return [_expense_to_dict(e) for e in s.query(Expense).all()]


def write_expense(expense_id, payer, amount, description, split_between, splits=None, date=None):
    with Session() as s:
        s.add(Expense(
            id=expense_id,
            payer=payer,
            amount=amount,
            description=description,
            split_between=",".join(split_between),
            splits=json.dumps(splits) if splits else '',
            date=date or datetime.now().strftime('%Y-%m-%d'),
        ))
        s.commit()


def update_expense(expense_id, payer, amount, description, split_between, splits, date):
    with Session() as s:
        e = s.get(Expense, expense_id)
        if not e:
            return False
        e.payer = payer
        e.amount = amount
        e.description = description
        e.split_between = ",".join(split_between)
        e.splits = json.dumps(splits) if splits else ''
        e.date = date
        s.commit()
        return True


def delete_expense_row(expense_id):
    with Session() as s:
        e = s.get(Expense, expense_id)
        if not e:
            return False
        s.delete(e)
        s.commit()
        return True


def read_settlements():
    with Session() as s:
        return [
            {'id': x.id, 'debtor': x.debtor, 'creditor': x.creditor, 'amount': round(float(x.amount), 2)}
            for x in s.query(Settlement).all()
        ]


def write_settlement(settlement_id, debtor, creditor, amount):
    with Session() as s:
        s.add(Settlement(id=settlement_id, debtor=debtor, creditor=creditor, amount=amount))
        s.commit()


# --- API Endpoints ---

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


@app.route('/people/add', methods=['POST'])
def add_person():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Name field is required'}), 400

    name = data['name'].strip()
    if not name:
        return jsonify({'error': 'Name cannot be empty'}), 400

    people = read_people()
    if any(p.lower() == name.lower() for p in people):
        return jsonify({'error': f'Person "{name}" already exists'}), 400

    write_person(name)
    return jsonify({'message': 'Person added successfully', 'name': name}), 201


@app.route('/people', methods=['GET'])
def get_people():
    try:
        return jsonify(read_people()), 200
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
    splits = data.get('splits')  # optional custom splits dict
    date = data.get('date')

    if not payer or amount_val is None:
        return jsonify({'error': 'payer and amount are required fields'}), 400

    try:
        amount = round(float(amount_val), 2)
    except (ValueError, TypeError):
        return jsonify({'error': 'Amount must be a valid number'}), 400

    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than 0'}), 400

    people = read_people()
    if payer not in people:
        return jsonify({'error': f'Payer "{payer}" is not registered'}), 400

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
            except (ValueError, TypeError):
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
            'date': date,
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
    except (ValueError, TypeError):
        return jsonify({'error': 'Amount must be a valid number'}), 400

    if amount <= 0:
        return jsonify({'error': 'Amount must be greater than 0'}), 400

    people = read_people()
    if payer not in people:
        return jsonify({'error': f'Payer "{payer}" is not registered'}), 400

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
            except (ValueError, TypeError):
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

    if not update_expense(expense_id, payer, amount, description, split_between, splits, date):
        return jsonify({'error': 'Expense not found'}), 404

    return jsonify({'message': 'Expense updated successfully'}), 200


@app.route('/expense/<string:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    try:
        if not delete_expense_row(expense_id):
            return jsonify({'error': 'Expense not found'}), 404
        return jsonify({'message': 'Expense deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/expenses', methods=['GET'])
def get_expenses():
    try:
        return jsonify(read_expenses()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/balances', methods=['GET'])
def get_balances():
    try:
        people = read_people()
        expenses = read_expenses()
        settlements = read_settlements()

        balances = {person: 0.0 for person in people}

        for expense in expenses:
            payer = expense['payer']
            amount = expense['amount']
            split_between = expense['split_between']
            splits = expense.get('splits', {})

            if payer in balances:
                balances[payer] += amount

            if splits:
                for person, split_amount in splits.items():
                    if person in balances:
                        balances[person] -= float(split_amount)
            else:
                if not split_between:
                    continue
                split_amount = amount / len(split_between)
                for person in split_between:
                    if person in balances:
                        balances[person] -= split_amount

        for settlement in settlements:
            debtor = settlement['debtor']
            creditor = settlement['creditor']
            amount = settlement['amount']

            if debtor in balances:
                balances[debtor] += amount
            if creditor in balances:
                balances[creditor] -= amount

        debts = []
        creditors = sorted([[p, bal] for p, bal in balances.items() if bal > 0.005], key=lambda x: x[1], reverse=True)
        debtors = sorted([[p, -bal] for p, bal in balances.items() if bal < -0.005], key=lambda x: x[1], reverse=True)

        c_idx = 0
        d_idx = 0

        while c_idx < len(creditors) and d_idx < len(debtors):
            creditor, c_bal = creditors[c_idx]
            debtor, d_bal = debtors[d_idx]

            settled_amount = round(min(c_bal, d_bal), 2)

            if settled_amount > 0:
                debts.append({'from': debtor, 'to': creditor, 'amount': settled_amount})

            creditors[c_idx][1] -= settled_amount
            debtors[d_idx][1] -= settled_amount

            if creditors[c_idx][1] < 0.005:
                c_idx += 1
            if debtors[d_idx][1] < 0.005:
                d_idx += 1

        individual_balances = {p: round(bal, 2) for p, bal in balances.items()}

        return jsonify({
            'debts': debts,
            'balances': individual_balances,
            'settlements': settlements,
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
    except (ValueError, TypeError):
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
            'amount': amount,
        }
    }), 201


# --- Currency conversion API (read-only; never mutates stored data) ---
@app.route('/rates', methods=['GET'])
def get_rates():
    """Return the current stored exchange rates (PKR per 1 unit of currency)."""
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
    """Convert an amount from a source currency to PKR (calculator only).

    Accepts JSON: { "amount": 10.5, "from": "USD", "rate": optional_custom_rate }
    """
    data = request.get_json() or {}
    try:
        amount = float(data.get('amount', 0))
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid amount'}), 400

    src = (data.get('from') or 'PKR').upper()
    custom_rate = data.get('rate')

    if custom_rate is not None:
        try:
            rate = float(custom_rate)
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid custom rate'}), 400
    else:
        if os.path.exists(EXCHANGE_RATES_FILE):
            with open(EXCHANGE_RATES_FILE, 'r', encoding='utf-8') as f:
                rates = json.load(f)
            rate = rates[src] if src in rates else RATES_TO_PKR.get(src)
        else:
            rate = RATES_TO_PKR.get(src)

    if rate is None:
        return jsonify({'error': f'Unsupported source currency: {src}'}), 400

    pkr_value = round(amount * float(rate), 2)
    return jsonify({'amount': amount, 'from': src, 'rate': float(rate), 'pkr': pkr_value}), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
