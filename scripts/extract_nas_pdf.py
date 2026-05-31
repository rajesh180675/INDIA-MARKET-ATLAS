import pdfplumber, json, re

PDF_PATH = r"C:\Users\rajesh\WindsurfAPI\INDIA-MARKET-ATLAS\data\raw\mospi\STATE_SDP\nsdp_2025_09_01.pdf"

observations = []
source_run_id = 'mospi-nas-pdf-parse-2026-05-31'
period_q1 = 'Q1_FY2025-26'
period_july = '2025-07'

def parse_num(val):
    if not val or val.strip() == '':
        return None
    cleaned = val.replace(',', '').strip()
    try:
        return float(cleaned)
    except:
        return None

def clean_name(name):
    if not name:
        return ''
    return name.replace('\n', ' ').strip()

def looks_like_label(s):
    if not s:
        return True
    s_lower = s.lower()
    if '=100' in s_lower or 'index' in s_lower or 'rs.' in s_lower or 'rs crore' in s_lower:
        return True
    if re.match(r'^\d{4}=100$', s):
        return True
    if re.match(r'^index\s+\d{4}[-\s]+\d{2}=100$', s_lower):
        return True
    return False

def get_value_indices(row):
    row_len = len(row)
    if row_len >= 7:
        return (4, 5)
    elif row_len >= 6:
        return (3, 4)
    else:
        return (None, None)

with pdfplumber.open(PDF_PATH) as pdf:
    all_rows = []
    for page in pdf.pages:
        table = page.extract_table()
        if table:
            all_rows.extend(table)

    i = 0
    current_section = None

    while i < len(all_rows):
        row = all_rows[i]
        row_len = len(row)

        text = ' '.join([str(c) for c in row if c]).lower()

        if 'current prices' in text and 'gva' in text:
            current_section = 'current'
        elif 'constant' in text and '2011' in text and 'price' in text:
            current_section = 'constant'
        elif 'implicit price index' in text:
            current_section = 'deflator'
        elif 'index of industrial production' in text or 'production index' in text:
            current_section = 'iip'
        elif 'consumer price index' in text or text.strip() == '( cpi )':
            current_section = 'cpi'
        elif 'wholesale price index' in text:
            current_section = 'wpi'

        comp0 = clean_name(row[0]) if row_len > 0 and row[0] else ''
        comp1 = clean_name(row[1]) if row_len > 1 and row[1] else ''

        if comp1 and not looks_like_label(comp1):
            component = comp1
        elif comp0:
            component = comp0
        else:
            component = ''

        skip_components = [
            '', 'Unit of Description', '2', '1', 'SDDS Data Category and Component',
            'National Accounts', '( CPI )', 'Last updated: August 29th, 2025 (Updated Periodically)',
            'Unit of Description - Rupees (Rs.) in Crore. 1 Crore = 10 Million.',
            'IW - Industrial Workers; AL - Agricultural Labourers; RL - Rural Labourers; Base year for CPI',
            'AL/RL has been revised from 1986-87 to 2019 from June, 2025.',
            '@ Previous data refers to data for corresponding period in previous year.',
            'Financial figures are in Crore Indian Rupees unless otherwise specified. Data are in original terms unless indicated specifically to be seasonally adjusted or trend terms.',
            'This page is updated periodically. Unless otherwise indicated, data are preliminary when first released. Data are not seasonally adjusted.',
            'released. Data are not seasonally adjusted.'
        ]

        if component in skip_components or not component:
            i += 1
            continue

        latest_idx, prev_idx = get_value_indices(row)
        if latest_idx is None:
            i += 1
            continue

        val_latest = parse_num(row[latest_idx] if row_len > latest_idx else None)
        val_prev = parse_num(row[prev_idx] if row_len > prev_idx else None)

        if val_latest is None and i + 1 < len(all_rows):
            next_row = all_rows[i + 1]
            next_len = len(next_row)
            if next_len >= 6 and next_row[0] is None and (next_row[1] is None or not str(next_row[1]).strip()):
                next_latest_idx, next_prev_idx = get_value_indices(next_row)
                if next_latest_idx is not None:
                    next_val = parse_num(next_row[next_latest_idx])
                    if next_val is not None:
                        val_latest = next_val
                        val_prev = parse_num(next_row[next_prev_idx]) if next_prev_idx else None
                        i += 1

        if val_latest is None:
            i += 1
            continue

        component_lower = component.lower()

        if current_section == 'current':
            if 'gva at basic price' in component_lower and 'current' in component_lower:
                ind_id = 'NAS_GDP.GVA.current.2011-12'
            elif 'agriculture' in component_lower or 'livestock' in component_lower or 'fishing' in component_lower:
                ind_id = 'NAS_GDP.GVA.agriculture.current.2011-12'
            elif 'mining' in component_lower or 'quarrying' in component_lower:
                ind_id = 'NAS_GDP.GVA.mining.current.2011-12'
            elif 'manufacturing' in component_lower:
                ind_id = 'NAS_GDP.GVA.manufacturing.current.2011-12'
            elif 'electricity' in component_lower or 'gas' in component_lower or 'water' in component_lower:
                ind_id = 'NAS_GDP.GVA.electricity.current.2011-12'
            elif 'construction' in component_lower:
                ind_id = 'NAS_GDP.GVA.construction.current.2011-12'
            elif 'industries' in component_lower and '(a+b+c+d)' in component_lower:
                ind_id = 'NAS_GDP.GVA.industries.current.2011-12'
            elif 'trade' in component_lower or 'hotels' in component_lower or 'communication' in component_lower:
                ind_id = 'NAS_GDP.GVA.trade.current.2011-12'
            elif 'financial' in component_lower or 'real estate' in component_lower or 'professional' in component_lower:
                ind_id = 'NAS_GDP.GVA.finance.current.2011-12'
            elif 'public administration' in component_lower or 'defence' in component_lower:
                ind_id = 'NAS_GDP.GVA.public_admin.current.2011-12'
            elif 'services' in component_lower and '(e+f+g)' in component_lower:
                ind_id = 'NAS_GDP.GVA.services.current.2011-12'
            else:
                ind_id = 'NAS_GDP.GVA.other.current.2011-12'

            obs = {
                'indicator_id': ind_id,
                'geography_id': 'IN',
                'period_id': period_q1,
                'value': val_latest,
                'unit': 'Rs. crore',
                'dimensions': {
                    'price_basis': 'current',
                    'base_year': '2011-12',
                    'revision': 'latest',
                    'sector': component
                },
                'source_run_id': source_run_id,
                'quality_flags': []
            }
            observations.append(obs)

        elif current_section == 'constant':
            if 'gva at basic price' in component_lower:
                ind_id = 'NAS_GDP.GVA.constant.2011-12'
            elif 'agriculture' in component_lower or 'livestock' in component_lower or 'fishing' in component_lower:
                ind_id = 'NAS_GDP.GVA.agriculture.constant.2011-12'
            elif 'mining' in component_lower or 'quarrying' in component_lower:
                ind_id = 'NAS_GDP.GVA.mining.constant.2011-12'
            elif 'manufacturing' in component_lower:
                ind_id = 'NAS_GDP.GVA.manufacturing.constant.2011-12'
            elif 'electricity' in component_lower or 'gas' in component_lower or 'water' in component_lower:
                ind_id = 'NAS_GDP.GVA.electricity.constant.2011-12'
            elif 'construction' in component_lower:
                ind_id = 'NAS_GDP.GVA.construction.constant.2011-12'
            elif 'industries' in component_lower and '(a+b+c+d)' in component_lower:
                ind_id = 'NAS_GDP.GVA.industries.constant.2011-12'
            elif 'trade' in component_lower or 'hotels' in component_lower or 'communication' in component_lower:
                ind_id = 'NAS_GDP.GVA.trade.constant.2011-12'
            elif 'financial' in component_lower or 'real estate' in component_lower or 'professional' in component_lower:
                ind_id = 'NAS_GDP.GVA.finance.constant.2011-12'
            elif 'public administration' in component_lower or 'defence' in component_lower:
                ind_id = 'NAS_GDP.GVA.public_admin.constant.2011-12'
            elif 'services' in component_lower and '(e+f+g)' in component_lower:
                ind_id = 'NAS_GDP.GVA.services.constant.2011-12'
            else:
                ind_id = 'NAS_GDP.GVA.other.constant.2011-12'

            obs = {
                'indicator_id': ind_id,
                'geography_id': 'IN',
                'period_id': period_q1,
                'value': val_latest,
                'unit': 'Rs. crore',
                'dimensions': {
                    'price_basis': 'constant',
                    'base_year': '2011-12',
                    'revision': 'latest',
                    'sector': component
                },
                'source_run_id': source_run_id,
                'quality_flags': []
            }
            observations.append(obs)

        elif current_section == 'deflator':
            if 'gva at basic price' in component_lower:
                ind_id = 'NAS_GDP.GVA.deflator.2011-12'
            elif 'agriculture' in component_lower or 'livestock' in component_lower or 'fishing' in component_lower:
                ind_id = 'NAS_GDP.GVA.agriculture.deflator.2011-12'
            elif 'mining' in component_lower or 'quarrying' in component_lower:
                ind_id = 'NAS_GDP.GVA.mining.deflator.2011-12'
            elif 'manufacturing' in component_lower:
                ind_id = 'NAS_GDP.GVA.manufacturing.deflator.2011-12'
            elif 'electricity' in component_lower or 'gas' in component_lower or 'water' in component_lower:
                ind_id = 'NAS_GDP.GVA.electricity.deflator.2011-12'
            elif 'construction' in component_lower:
                ind_id = 'NAS_GDP.GVA.construction.deflator.2011-12'
            elif 'industries' in component_lower and '(a+b+c+d)' in component_lower:
                ind_id = 'NAS_GDP.GVA.industries.deflator.2011-12'
            elif 'trade' in component_lower or 'hotels' in component_lower or 'communication' in component_lower:
                ind_id = 'NAS_GDP.GVA.trade.deflator.2011-12'
            elif 'financial' in component_lower or 'real estate' in component_lower or 'professional' in component_lower:
                ind_id = 'NAS_GDP.GVA.finance.deflator.2011-12'
            elif 'public administration' in component_lower or 'defence' in component_lower:
                ind_id = 'NAS_GDP.GVA.public_admin.deflator.2011-12'
            elif 'services' in component_lower and '(e+f+g)' in component_lower:
                ind_id = 'NAS_GDP.GVA.services.deflator.2011-12'
            else:
                ind_id = 'NAS_GDP.GVA.other.deflator.2011-12'

            obs = {
                'indicator_id': ind_id,
                'geography_id': 'IN',
                'period_id': period_q1,
                'value': val_latest,
                'unit': 'Index',
                'dimensions': {
                    'price_basis': 'index',
                    'base_year': '2011-12',
                    'revision': 'latest',
                    'sector': component
                },
                'source_run_id': source_run_id,
                'quality_flags': []
            }
            observations.append(obs)

        elif current_section == 'iip':
            if 'index of industrial production' in component_lower or ('production index' in component_lower and 'industrial' in component_lower):
                ind_id = 'NAS_GDP.IIP.overall.2011-12'
            elif 'mining' in component_lower and 'manufacturing' not in component_lower and 'electricity' not in component_lower:
                ind_id = 'NAS_GDP.IIP.mining.2011-12'
            elif 'manufacturing' in component_lower:
                ind_id = 'NAS_GDP.IIP.manufacturing.2011-12'
            elif 'electricity' in component_lower:
                ind_id = 'NAS_GDP.IIP.electricity.2011-12'
            elif 'capital goods' in component_lower:
                ind_id = 'NAS_GDP.IIP.capital_goods.2011-12'
            elif 'intermediate' in component_lower:
                ind_id = 'NAS_GDP.IIP.intermediate_goods.2011-12'
            elif 'consumer durables' in component_lower:
                ind_id = 'NAS_GDP.IIP.consumer_durables.2011-12'
            elif 'consumer non' in component_lower:
                ind_id = 'NAS_GDP.IIP.consumer_non_durables.2011-12'
            else:
                ind_id = 'NAS_GDP.IIP.other.2011-12'

            obs = {
                'indicator_id': ind_id,
                'geography_id': 'IN',
                'period_id': period_july,
                'value': val_latest,
                'unit': 'Index 2011-12=100',
                'dimensions': {
                    'price_basis': 'index',
                    'base_year': '2011-12',
                    'revision': 'latest',
                    'sector': component
                },
                'source_run_id': source_run_id,
                'quality_flags': []
            }
            observations.append(obs)

        elif current_section == 'cpi':
            if 'cpi-iw' in component_lower:
                ind_id = 'NAS_GDP.CPI.industrial_workers.2016'
                base = '2016'
            elif 'cpi-al' in component_lower:
                ind_id = 'NAS_GDP.CPI.agricultural_labourers.2019'
                base = '2019'
            elif 'cpi-rl' in component_lower:
                ind_id = 'NAS_GDP.CPI.rural_labourers.2019'
                base = '2019'
            elif 'cpi-rural' in component_lower and 'urban' not in component_lower:
                ind_id = 'NAS_GDP.CPI.rural.2012'
                base = '2012'
            elif 'cpi-urban' in component_lower:
                ind_id = 'NAS_GDP.CPI.urban.2012'
                base = '2012'
            elif 'cpi-combined' in component_lower:
                ind_id = 'NAS_GDP.CPI.combined.2012'
                base = '2012'
            else:
                ind_id = 'NAS_GDP.CPI.other'
                base = 'unknown'

            obs = {
                'indicator_id': ind_id,
                'geography_id': 'IN',
                'period_id': period_july,
                'value': val_latest,
                'unit': f'{base}=100',
                'dimensions': {
                    'price_basis': 'index',
                    'base_year': base,
                    'revision': 'latest',
                    'sector': component
                },
                'source_run_id': source_run_id,
                'quality_flags': []
            }
            observations.append(obs)

        elif current_section == 'wpi':
            ind_id = 'NAS_GDP.WPI.overall.2011-12'
            obs = {
                'indicator_id': ind_id,
                'geography_id': 'IN',
                'period_id': period_july,
                'value': val_latest,
                'unit': 'Index 2011-12=100',
                'dimensions': {
                    'price_basis': 'index',
                    'base_year': '2011-12',
                    'revision': 'latest',
                    'sector': component
                },
                'source_run_id': source_run_id,
                'quality_flags': []
            }
            observations.append(obs)

        i += 1

print(json.dumps(observations, indent=2))
