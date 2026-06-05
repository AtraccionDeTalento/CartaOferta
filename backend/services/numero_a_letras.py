"""Conversión de números a letras en español (moneda peruana)."""

_UNIDADES = [
    "", "Un", "Dos", "Tres", "Cuatro", "Cinco",
    "Seis", "Siete", "Ocho", "Nueve", "Diez",
    "Once", "Doce", "Trece", "Catorce", "Quince",
    "Dieciséis", "Diecisiete", "Dieciocho", "Diecinueve", "Veinte",
    "Veintiún", "Veintidós", "Veintitrés", "Veinticuatro", "Veinticinco",
    "Veintiséis", "Veintisiete", "Veintiocho", "Veintinueve",
]

_DECENAS = [
    "", "", "Veinte", "Treinta", "Cuarenta", "Cincuenta",
    "Sesenta", "Setenta", "Ochenta", "Noventa",
]

_CENTENAS = [
    "", "Ciento", "Doscientos", "Trescientos", "Cuatrocientos", "Quinientos",
    "Seiscientos", "Setecientos", "Ochocientos", "Novecientos",
]


def _convertir_grupo(n: int) -> str:
    """Convierte un número de 0 a 999 a texto."""
    if n == 0:
        return ""
    if n == 100:
        return "Cien"

    resultado = ""
    centena = n // 100
    resto = n % 100

    if centena > 0:
        resultado = _CENTENAS[centena]
        if resto > 0:
            resultado += " "

    if resto <= 29:
        resultado += _UNIDADES[resto]
    else:
        decena = resto // 10
        unidad = resto % 10
        resultado += _DECENAS[decena]
        if unidad > 0:
            resultado += " y " + _UNIDADES[unidad]

    return resultado


def numero_a_letras(numero: float) -> str:
    """
    Convierte un número a su representación en letras para moneda peruana.
    Ejemplo: 2500 -> 'Dos Mil Quinientos con 00/100 soles'
    Ejemplo: 1200.50 -> 'Mil Doscientos con 50/100 soles'
    """
    if numero == 0:
        return "Cero con 00/100 soles"

    entero = int(numero)
    centavos = round((numero - entero) * 100)

    if entero == 0:
        texto = "Cero"
    else:
        partes = []

        # Millones
        millones = entero // 1_000_000
        if millones > 0:
            if millones == 1:
                partes.append("Un Millón")
            else:
                partes.append(_convertir_grupo(millones) + " Millones")
            entero %= 1_000_000

        # Miles
        miles = entero // 1_000
        if miles > 0:
            if miles == 1:
                partes.append("Mil")
            else:
                partes.append(_convertir_grupo(miles) + " Mil")
            entero %= 1_000

        # Unidades
        if entero > 0:
            partes.append(_convertir_grupo(entero))

        texto = " ".join(partes)

    return f"{texto} con {centavos:02d}/100 soles"
