import openpyxl
import os
import json
import sqlite3

excel_path = r"c:\Users\jlopezp\OneDrive - Universidad San Ignacio de Loyola\ACTIVIDADES\DEBORA\Libro2.xlsx"
output_dir = r"c:\Users\jlopezp\OneDrive - Universidad San Ignacio de Loyola\ACTIVIDADES\DEBORA\hr-ops-system\data\normalized"
db_path = r"c:\Users\jlopezp\OneDrive - Universidad San Ignacio de Loyola\ACTIVIDADES\DEBORA\hr-ops-system\data\hr_ops.db"

os.makedirs(output_dir, exist_ok=True)

# Homologation dictionary for character encoding errors in raw Excel
HOMOLOGATIONS = {
    "ACADMICO": "ACADÉMICO",
    "TESORERA": "TESORERÍA",
    "CDIGO": "CÓDIGO",
    "ADMINISTRACIN": "ADMINISTRACIÓN",
    "PLANIFICACIN": "PLANIFICACIÓN",
    "TECNOLOGA": "TECNOLOGÍA",
    "ASOCIACIN": "ASOCIACIÓN",
    "EDUCACIN": "EDUCACIÓN",
    "DIRECCIN": "DIRECCIÓN",
    "GESTIN": "GESTIÓN",
    "REPRESENTACIN": "REPRESENTACIÓN",
    "COMUNICACIN": "COMUNICACIÓN",
    "SECCIN": "SECCIÓN",
    "PRODUCCIN": "PRODUCCIÓN",
    "OPERACIN": "OPERACIÓN",
    "DEPOSIT": "DEPOSITÓ",
    "POSTGRADO": "POSGRADO", # standardizing postgrado to posgrado
}

def clean_value(val):
    if val is None:
        return ""
    val = str(val).strip()
    # Replace double spaces
    while "  " in val:
        val = val.replace("  ", " ")
    val = val.upper()
    # Apply homologation replacements
    for bad, good in HOMOLOGATIONS.items():
        val = val.replace(bad.upper(), good.upper())
    return val

def main():
    if not os.path.exists(excel_path):
        print(f"Error: {excel_path} not found.")
        return

    print("Opening Libro2.xlsx...")
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb["Hoja2"]
    
    rows = list(ws.iter_rows(values_only=True))
    header_row = None
    data_rows = []
    
    # Find headers starting with 'Sucursal'
    for idx, row in enumerate(rows):
        if row and any(isinstance(val, str) and 'Sucursal' in val for val in row):
            header_row = [clean_value(h) for h in row]
            data_rows = rows[idx+1:]
            print(f"Header found at row {idx+1}")
            break
            
    if not header_row:
        print("Error: Could not find header row in Hoja2.")
        return
        
    print(f"Total raw rows: {len(data_rows)}")
    
    # Dictionaries to assign IDs
    sucursales_dict = {}
    departamentos_dict = {}
    areas_dict = {}
    unidades_dict = {}
    puestos_dict = {}
    cecos_dict = {} # ceco_code -> ceco_desc
    
    estructura = []
    
    # Counter utilities
    def get_or_create_id(value, entity_dict):
        if not value:
            return None
        if value not in entity_dict:
            entity_dict[value] = len(entity_dict) + 1
        return entity_dict[value]

    for idx, r in enumerate(data_rows):
        if len(r) < 7:
            continue
            
        suc = clean_value(r[0])
        dept = clean_value(r[1])
        area = clean_value(r[2])
        uni = clean_value(r[3])
        puesto = clean_value(r[4])
        ceco_code = clean_value(r[5])
        ceco_desc = clean_value(r[6])
        
        # Skip fully empty rows
        if not any([suc, dept, area, uni, puesto, ceco_code]):
            continue
            
        # Get relational IDs
        suc_id = get_or_create_id(suc, sucursales_dict)
        dept_id = get_or_create_id(dept, departamentos_dict)
        area_id = get_or_create_id(area, areas_dict) # Can be None/blank
        uni_id = get_or_create_id(uni, unidades_dict)
        puesto_id = get_or_create_id(puesto, puestos_dict)
        
        if ceco_code:
            cecos_dict[ceco_code] = ceco_desc
            
        estructura.append({
            "id": len(estructura) + 1,
            "sucursal_id": suc_id,
            "departamento_id": dept_id,
            "area_id": area_id,
            "unidad_id": uni_id,
            "puesto_id": puesto_id,
            "ceco_code": ceco_code or None
        })

    # Prepare catalog arrays
    sucursales_list = [{"id": v, "nombre": k} for k, v in sucursales_dict.items()]
    departamentos_list = [{"id": v, "nombre": k} for k, v in departamentos_dict.items()]
    areas_list = [{"id": v, "nombre": k} for k, v in areas_dict.items()]
    unidades_list = [{"id": v, "nombre": k} for k, v in unidades_dict.items()]
    puestos_list = [{"id": v, "nombre": k} for k, v in puestos_dict.items()]
    cecos_list = [{"codigo": k, "descripcion": v} for k, v in cecos_dict.items()]
    
    # Save to JSON files
    catalogos = {
        "sucursales": sucursales_list,
        "departamentos": departamentos_list,
        "areas": areas_list,
        "unidades": unidades_list,
        "puestos": puestos_list,
        "cecos": cecos_list,
        "estructura_organizacional": estructura
    }
    
    react_public_dir = r"c:\Users\jlopezp\OneDrive - Universidad San Ignacio de Loyola\ACTIVIDADES\DEBORA\hr-ops-system\frontend-react\public\data\normalized"
    os.makedirs(react_public_dir, exist_ok=True)
    for key, val in catalogos.items():
        with open(os.path.join(output_dir, f"{key}.json"), "w", encoding="utf-8") as f:
            json.dump(val, f, ensure_ascii=False, indent=2)
        with open(os.path.join(react_public_dir, f"{key}.json"), "w", encoding="utf-8") as f:
            json.dump(val, f, ensure_ascii=False, indent=2)
            
    print(f"Saved {len(sucursales_list)} sucursales")
    print(f"Saved {len(departamentos_list)} departamentos")
    print(f"Saved {len(areas_list)} areas")
    print(f"Saved {len(unidades_list)} unidades")
    print(f"Saved {len(puestos_list)} puestos")
    print(f"Saved {len(cecos_list)} cecos")
    print(f"Saved {len(estructura)} relations in estructura_organizacional")
    
    # Optional: Save to SQLite database
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create tables
        cursor.execute("DROP TABLE IF EXISTS org_sucursales")
        cursor.execute("CREATE TABLE org_sucursales (id INTEGER PRIMARY KEY, nombre TEXT)")
        
        cursor.execute("DROP TABLE IF EXISTS org_departamentos")
        cursor.execute("CREATE TABLE org_departamentos (id INTEGER PRIMARY KEY, nombre TEXT)")
        
        cursor.execute("DROP TABLE IF EXISTS org_areas")
        cursor.execute("CREATE TABLE org_areas (id INTEGER PRIMARY KEY, nombre TEXT)")
        
        cursor.execute("DROP TABLE IF EXISTS org_unidades")
        cursor.execute("CREATE TABLE org_unidades (id INTEGER PRIMARY KEY, nombre TEXT)")
        
        cursor.execute("DROP TABLE IF EXISTS org_puestos")
        cursor.execute("CREATE TABLE org_puestos (id INTEGER PRIMARY KEY, nombre TEXT)")
        
        cursor.execute("DROP TABLE IF EXISTS org_cecos")
        cursor.execute("CREATE TABLE org_cecos (codigo TEXT PRIMARY KEY, descripcion TEXT)")
        
        cursor.execute("DROP TABLE IF EXISTS org_estructura")
        cursor.execute("""
            CREATE TABLE org_estructura (
                id INTEGER PRIMARY KEY,
                sucursal_id INTEGER,
                departamento_id INTEGER,
                area_id INTEGER,
                unidad_id INTEGER,
                puesto_id INTEGER,
                ceco_code TEXT,
                FOREIGN KEY(sucursal_id) REFERENCES org_sucursales(id),
                FOREIGN KEY(departamento_id) REFERENCES org_departamentos(id),
                FOREIGN KEY(area_id) REFERENCES org_areas(id),
                FOREIGN KEY(unidad_id) REFERENCES org_unidades(id),
                FOREIGN KEY(puesto_id) REFERENCES org_puestos(id),
                FOREIGN KEY(ceco_code) REFERENCES org_cecos(codigo)
            )
        """)
        
        # Insert data
        cursor.executemany("INSERT INTO org_sucursales (id, nombre) VALUES (?, ?)", [(x["id"], x["nombre"]) for x in sucursales_list])
        cursor.executemany("INSERT INTO org_departamentos (id, nombre) VALUES (?, ?)", [(x["id"], x["nombre"]) for x in departamentos_list])
        cursor.executemany("INSERT INTO org_areas (id, nombre) VALUES (?, ?)", [(x["id"], x["nombre"]) for x in areas_list])
        cursor.executemany("INSERT INTO org_unidades (id, nombre) VALUES (?, ?)", [(x["id"], x["nombre"]) for x in unidades_list])
        cursor.executemany("INSERT INTO org_puestos (id, nombre) VALUES (?, ?)", [(x["id"], x["nombre"]) for x in puestos_list])
        cursor.executemany("INSERT INTO org_cecos (codigo, descripcion) VALUES (?, ?)", [(x["codigo"], x["descripcion"]) for x in cecos_list])
        
        cursor.executemany("""
            INSERT INTO org_estructura (id, sucursal_id, departamento_id, area_id, unidad_id, puesto_id, ceco_code)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [(x["id"], x["sucursal_id"], x["departamento_id"], x["area_id"], x["unidad_id"], x["puesto_id"], x["ceco_code"]) for x in estructura])
        
        conn.commit()
        conn.close()
        print("Relational database populated successfully in local SQLite (hr_ops.db).")
    except Exception as e:
        print(f"Error populating SQLite: {e}")

if __name__ == "__main__":
    main()
