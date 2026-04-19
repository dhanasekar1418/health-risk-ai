import re


# ─────────────────────────────────────────────
# FIELD NORMALIZER
# ─────────────────────────────────────────────

FIELD_ALIASES = {
    "age": ["age", "years", "patient_age"],
    "heart_rate": ["heart_rate", "hr", "pulse", "heartrate", "heart rate", "bpm"],
    "spo2": ["spo2", "sp02", "oxygen", "oxygen_level", "o2", "oxygen_saturation", "spo₂"],
    "temperature": ["temperature", "temp", "body_temp", "body_temperature"],
    "activity_level": ["activity", "activity_level", "physical_activity", "exercise"],
    "smoking": ["smoking", "smoker", "smoke", "tobacco"],
    "alcohol": ["alcohol", "drinking", "drink", "alcohol_use"],
    "bmi": ["bmi", "body_mass_index"],
    "name": ["name", "patient_name", "patient"],
    "patient_id": ["patient_id", "id", "patient_no"],
}


def normalize_record(rec):
    """Map any column name to our standard field names."""
    normalized = {}
    lower_rec = {str(k).strip().lower().replace(" ", "_"): v for k, v in rec.items()}

    for field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            alias_key = alias.replace(" ", "_")
            if alias_key in lower_rec:
                normalized[field] = lower_rec[alias_key]
                break

    # Copy over patient_id / name if present
    for k in ["patient_id", "name", "patient_name"]:
        if k in lower_rec and k not in normalized:
            normalized[k] = lower_rec[k]

    return normalized


# ─────────────────────────────────────────────
# INDIVIDUAL SCORING FUNCTIONS
# ─────────────────────────────────────────────

def score_heart_rate(hr, age):
    try:
        hr = float(hr)
        age = float(age) if age else 40
    except:
        return {"score": 20, "level": "unknown", "note": "Heart rate value unreadable"}

    max_hr = 220 - age
    if hr > max_hr * 0.9 or hr > 130 or hr < 40:
        return {"score": 90, "level": "High", "note": f"Critically abnormal heart rate ({hr:.0f} bpm)"}
    if hr > 110 or hr < 50:
        return {"score": 65, "level": "High", "note": f"Elevated heart rate ({hr:.0f} bpm)"}
    if hr > 100 or hr < 60:
        return {"score": 40, "level": "Medium", "note": f"Slightly irregular heart rate ({hr:.0f} bpm)"}
    return {"score": 10, "level": "Low", "note": f"Heart rate normal ({hr:.0f} bpm)"}


def score_spo2(spo2):
    try:
        spo2 = float(spo2)
    except:
        return {"score": 20, "level": "unknown", "note": "SpO₂ value unreadable"}

    if spo2 < 90:
        return {"score": 95, "level": "High", "note": f"Critically low oxygen ({spo2:.1f}%) — seek immediate care"}
    if spo2 < 92:
        return {"score": 80, "level": "High", "note": f"Severely low SpO₂ ({spo2:.1f}%) — respiratory risk"}
    if spo2 < 95:
        return {"score": 45, "level": "Medium", "note": f"Mildly low oxygen saturation ({spo2:.1f}%)"}
    return {"score": 5, "level": "Low", "note": f"Oxygen level healthy ({spo2:.1f}%)"}


def score_temperature(temp):
    try:
        temp = float(temp)
    except:
        return {"score": 20, "level": "unknown", "note": "Temperature value unreadable"}

    if temp > 39.5:
        return {"score": 90, "level": "High", "note": f"High fever ({temp:.1f}°C)"}
    if temp > 38.5:
        return {"score": 70, "level": "High", "note": f"Fever present ({temp:.1f}°C)"}
    if temp > 38.0:
        return {"score": 50, "level": "Medium", "note": f"Elevated temperature ({temp:.1f}°C)"}
    if temp < 35.5:
        return {"score": 75, "level": "High", "note": f"Hypothermia risk ({temp:.1f}°C)"}
    return {"score": 5, "level": "Low", "note": f"Temperature normal ({temp:.1f}°C)"}


def score_lifestyle(activity, smoking, alcohol, bmi):
    score = 0
    notes = []

    activity_scores = {
        "sedentary": 40, "inactive": 40, "none": 40,
        "low": 25, "light": 25, "minimal": 25,
        "moderate": 10, "regular": 10,
        "active": 5, "high": 5,
        "very_active": 3, "very active": 3, "athlete": 3,
    }
    smoking_scores = {
        "no": 0, "none": 0, "never": 0, "non-smoker": 0, "non_smoker": 0,
        "occasional": 25, "social": 20,
        "regular": 55, "yes": 55, "smoker": 55,
        "heavy": 80,
    }
    alcohol_scores = {
        "no": 0, "none": 0, "never": 0, "non-drinker": 0,
        "occasional": 15, "social": 10, "light": 10,
        "regular": 35, "moderate": 30, "yes": 35,
        "heavy": 65,
    }

    a_key = str(activity).strip().lower() if activity else "moderate"
    s_key = str(smoking).strip().lower() if smoking else "no"
    al_key = str(alcohol).strip().lower() if alcohol else "no"

    a_score = activity_scores.get(a_key, 20)
    s_score = smoking_scores.get(s_key, 0)
    al_score = alcohol_scores.get(al_key, 0)

    score = a_score * 0.35 + s_score * 0.35 + al_score * 0.2

    if a_score >= 30:
        notes.append(f"Low physical activity ({activity})")
    if s_score >= 50:
        notes.append(f"Smoking habit detected ({smoking})")
    elif s_score >= 20:
        notes.append(f"Occasional smoking noted")
    if al_score >= 30:
        notes.append(f"Regular alcohol consumption")

    if bmi:
        try:
            bmi = float(bmi)
            if bmi > 35:
                score += 20
                notes.append(f"Severely high BMI ({bmi:.1f})")
            elif bmi > 30:
                score += 12
                notes.append(f"High BMI ({bmi:.1f})")
            elif bmi > 25:
                score += 5
            elif bmi < 16:
                score += 20
                notes.append(f"Very low BMI ({bmi:.1f}) — underweight risk")
            elif bmi < 18.5:
                score += 8
                notes.append(f"Low BMI ({bmi:.1f})")
        except:
            pass

    return {
        "score": min(100, round(score)),
        "level": "High" if score > 60 else ("Medium" if score > 30 else "Low"),
        "notes": notes if notes else ["Lifestyle factors within acceptable range"]
    }


# ─────────────────────────────────────────────
# MAIN RISK CALCULATOR
# ─────────────────────────────────────────────

def calculate_risk(raw_record):
    rec = normalize_record(raw_record)

    age = rec.get("age")
    hr = rec.get("heart_rate")
    spo2 = rec.get("spo2")
    temp = rec.get("temperature")
    activity = rec.get("activity_level", "moderate")
    smoking = rec.get("smoking", "no")
    alcohol = rec.get("alcohol", "no")
    bmi = rec.get("bmi")

    if not all([hr, spo2, temp]):
        raise ValueError("Missing required fields: heart_rate, spo2, temperature")

    hr_result = score_heart_rate(hr, age)
    spo2_result = score_spo2(spo2)
    temp_result = score_temperature(temp)
    life_result = score_lifestyle(activity, smoking, alcohol, bmi)

    # Weighted formula
    final_score = round(
        0.30 * hr_result["score"] +
        0.30 * spo2_result["score"] +
        0.20 * temp_result["score"] +
        0.20 * life_result["score"]
    )
    final_score = max(0, min(100, final_score))

    if final_score >= 65:
        risk_level = "High"
        risk_color = "#E24B4A"
    elif final_score >= 35:
        risk_level = "Medium"
        risk_color = "#EF9F27"
    else:
        risk_level = "Low"
        risk_color = "#639922"

    # Collect issues
    issues = []
    for result, label in [(hr_result, "Heart Rate"), (spo2_result, "SpO₂"), (temp_result, "Temperature")]:
        if result["level"] in ("High", "Medium"):
            issues.append({"label": label, "note": result["note"], "level": result["level"]})
    for note in life_result["notes"]:
        if life_result["level"] in ("High", "Medium"):
            issues.append({"label": "Lifestyle", "note": note, "level": life_result["level"]})

    if not issues:
        issues.append({"label": "General", "note": "All vitals within healthy range", "level": "Low"})

    # Generate suggestions
    suggestions = generate_suggestions(rec, risk_level, issues, final_score)

    return {
        "risk_score": final_score,
        "risk_level": risk_level,
        "risk_color": risk_color,
        "component_scores": {
            "heart_rate": hr_result,
            "spo2": spo2_result,
            "temperature": temp_result,
            "lifestyle": life_result,
        },
        "issues": issues,
        "suggestions": suggestions,
        "vitals": {
            "age": age,
            "heart_rate": hr,
            "spo2": spo2,
            "temperature": temp,
            "activity_level": activity,
            "smoking": smoking,
            "alcohol": alcohol,
            "bmi": bmi,
        }
    }


def generate_suggestions(rec, risk_level, issues, score):
    suggestions = []

    hr = rec.get("heart_rate")
    spo2 = rec.get("spo2")
    temp = rec.get("temperature")
    smoking = rec.get("smoking", "no")
    alcohol = rec.get("alcohol", "no")
    activity = rec.get("activity_level", "moderate")
    bmi = rec.get("bmi")

    try:
        if float(hr) > 100:
            suggestions.append("🫀 Reduce caffeine intake and practice deep breathing exercises to lower elevated heart rate.")
        if float(spo2) < 95:
            suggestions.append("🫁 Practice diaphragmatic breathing and ensure good ventilation. Consult a doctor if SpO₂ persists below 95%.")
        if float(temp) > 38.0:
            suggestions.append("🌡️ Stay hydrated and rest. If fever persists over 38.5°C for more than 2 days, seek medical attention.")
    except:
        pass

    if str(smoking).lower() in ["regular", "heavy", "yes"]:
        suggestions.append("🚭 Smoking significantly increases cardiovascular and respiratory risk. Consider a cessation program.")
    if str(alcohol).lower() in ["regular", "heavy"]:
        suggestions.append("🍷 Reduce alcohol consumption. Aim for less than 14 units per week.")
    if str(activity).lower() in ["sedentary", "low", "inactive", "none"]:
        suggestions.append("🏃 Aim for at least 30 minutes of moderate exercise 5 days a week to reduce overall health risk.")

    if bmi:
        try:
            bmi_f = float(bmi)
            if bmi_f > 30:
                suggestions.append(f"⚖️ Your BMI of {bmi_f:.1f} is in the obese range. A nutritionist-guided diet and regular exercise can help.")
            elif bmi_f < 18.5:
                suggestions.append(f"⚖️ Your BMI of {bmi_f:.1f} suggests underweight. Consult a doctor for a healthy nutrition plan.")
        except:
            pass

    if risk_level == "High" and not suggestions:
        suggestions.append("⚠️ Multiple risk indicators detected. Strongly recommend consulting a healthcare professional immediately.")
    elif risk_level == "Medium" and not suggestions:
        suggestions.append("📋 Some vitals are outside normal range. Monitor regularly and consider a routine health checkup.")
    elif risk_level == "Low":
        suggestions.append("✅ Your vitals look healthy! Maintain your current lifestyle habits and schedule annual checkups.")

    return suggestions


# ─────────────────────────────────────────────
# TEXT / PDF PARSER
# ─────────────────────────────────────────────

def extract_fields_from_text(text):
    """Extract patient records from unstructured text (PDF/TXT reports)."""
    records = []

    # Try to split by patient sections
    patient_blocks = re.split(r"(?i)patient\s*[:\-#]?\s*\d+|---+|===+", text)
    if len(patient_blocks) <= 1:
        patient_blocks = [text]

    patterns = {
        "patient_id": r"(?:patient\s*(?:id|no|name)?[:\s]+)([A-Za-z0-9_\- ]+)",
        "age": r"(?:age|years)[:\s]+(\d{1,3})",
        "heart_rate": r"(?:heart\s*rate|hr|pulse|bpm)[:\s]+(\d{2,3})",
        "spo2": r"(?:spo2?|oxygen(?:\s*level)?|o2)[:\s%]+(\d{2,3}(?:\.\d)?)",
        "temperature": r"(?:temp(?:erature)?)[:\s]+(\d{2}(?:\.\d{1,2})?)",
        "bmi": r"(?:bmi|body\s*mass\s*index)[:\s]+(\d{2}(?:\.\d{1,2})?)",
        "smoking": r"(?:smoking|smoker|tobacco)[:\s]+(\w+)",
        "alcohol": r"(?:alcohol|drinking)[:\s]+(\w+)",
        "activity_level": r"(?:activity(?:\s*level)?|exercise)[:\s]+(\w+(?:\s*\w+)?)",
    }

    for block in patient_blocks:
        block = block.strip()
        if not block:
            continue

        record = {}
        for field, pattern in patterns.items():
            match = re.search(pattern, block, re.IGNORECASE)
            if match:
                record[field] = match.group(1).strip()

        if any(k in record for k in ["heart_rate", "spo2", "temperature"]):
            records.append(record)

    return records if records else []
