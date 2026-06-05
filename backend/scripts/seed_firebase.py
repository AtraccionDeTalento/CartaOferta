"""
Script para migrar los datos locales de SQLite a Firebase Firestore,
incluyendo la nueva estructura organizacional normalizada de Libro2.xlsx.
Requisitos:
  pip install firebase-admin

Uso:
  1. Descarga el archivo de clave de cuenta de servicio de Firebase (JSON) desde la Consola de Firebase.
  2. Guárdalo como 'serviceAccountKey.json' en la raíz del proyecto.
  3. Ejecuta este script: python backend/scripts/seed_firebase.py
"""

import os
import sqlite3
import firebase_admin
from firebase_admin import credentials, firestore

def main():
    # Buscar el archivo de credenciales
    cred_path = 'serviceAccountKey.json'
    if not os.path.exists(cred_path):
        print(f"⚠️ Error: No se encontró el archivo '{cred_path}'.")
        print("Por favor descargue la clave privada JSON de su cuenta de servicio en Firebase Console")
        print("(Configuración del proyecto -> Cuentas de servicio -> Generar nueva clave privada)")
        print(f"y guárdelo como '{os.path.abspath(cred_path)}'.")
        return

    db_path = 'data/hr_ops.db'
    if not os.path.exists(db_path):
        print(f"⚠️ Error: No se encontró la base de datos SQLite en '{db_path}'.")
        return

    # Inicializar Firebase
    print("Conectando con Firebase...")
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✓ Conectado a Firebase Firestore con éxito.")

    # Conectar a SQLite
    print("Conectando a SQLite...")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Mapeo de tablas de SQLite a colecciones de Firestore
    tablas = {
        'solicitudes_ingreso': 'solicitudes_ingreso',
        'movimientos': 'movimientos',
        'cartas_oferta': 'cartas_oferta',
        'unidades_negocio': 'unidades_negocio',
        'tipos_documento': 'tipos_documento',
        # Nuevas tablas del organigrama
        'org_sucursales': 'sucursales',
        'org_departamentos': 'departamentos',
        'org_areas': 'areas',
        'org_unidades': 'unidades',
        'org_puestos': 'puestos',
        'org_cecos': 'cecos',
        'org_estructura': 'estructura_organizacional'
    }

    for sqlite_table, firestore_collection in tablas.items():
        try:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{sqlite_table}'")
            if not cursor.fetchone():
                print(f"La tabla {sqlite_table} no existe en la base de datos, omitiendo...")
                continue

            cursor.execute(f"SELECT * FROM {sqlite_table}")
            rows = cursor.fetchall()
            print(f"Migrando {len(rows)} registros de '{sqlite_table}' a la colección '{firestore_collection}'...")

            batch = db.batch()
            count = 0
            for row in rows:
                data = dict(row)
                
                # Firestore no permite IDs enteros directamente, usaremos string.
                # Para CECOs el id se llama 'codigo'.
                doc_id = str(data.get('id') if data.get('id') is not None else data.get('codigo'))
                
                doc_ref = db.collection(firestore_collection).document(doc_id)
                batch.set(doc_ref, data)
                count += 1

                # Subir en lotes de 400 (límite de Firestore es 500 por lote)
                if count % 400 == 0:
                    batch.commit()
                    batch = db.batch()
                    print(f"  Enviados {count} registros...")

            if count % 400 != 0:
                batch.commit()
                
            print(f"✓ {count} registros migrados con éxito de '{sqlite_table}'.")

        except Exception as e:
            print(f"❌ Error al migrar la tabla '{sqlite_table}': {e}")

    conn.close()
    print("\n🎉 ¡Migración de datos completada con éxito!")

if __name__ == '__main__':
    main()
