import re

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
    normalized = {}
    lower_rec = {str(k).strip().lower().replace(" ", "_"): v for k, v in rec.items()}
    for field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if alias.replace(" ", "_") in lower_rec:
                normalized[field] = lower_rec[alias.replace(" ", "_")]
                break
    for k in ["patient_id", "name", "patient_name"]:
        if k in lower_rec and k not in normalized:
            normalized[k] = lower_rec[k]
    return normalized

def score_heart_rate(hr, age):
    try:
        hr = float(hr); age = float(age) if age else 40
    except:
        return {"score": 20, "level": "unknown", "note": "Heart rate unreadable"}
    if hr > 130 or hr < 40:
        return {"score": 90, "level": "High",   "note": f"Critically abnormal heart rate ({hr:.0f} bpm)"}
    if hr > 110 or hr < 50:
        return {"score": 65, "level": "High",   "note": f"Elevated heart rate ({hr:.0f} bpm)"}
    if hr > 100 or hr < 60:
        return {"score": 40, "level": "Medium", "note": f"Slightly irregular heart rate ({hr:.0f} bpm)"}
    return {"score": 10, "level": "Low", "note": f"Heart rate normal ({hr:.0f} bpm)"}

def score_spo2(spo2):
    try:
        spo2 = float(spo2)
    except:
        return {"score": 20, "level": "unknown", "note": "SpO₂ unreadable"}
    if spo2 < 90:
        return {"score": 95, "level": "High",   "note": f"Critically low oxygen ({spo2:.1f}%) — seek immediate care"}
    if spo2 < 92:
        return {"score": 80, "level": "High",   "note": f"Severely low SpO₂ ({spo2:.1f}%)"}
    if spo2 < 95:
        return {"score": 45, "level": "Medium", "note": f"Mildly low oxygen ({spo2:.1f}%)"}
    return {"score": 5, "level": "Low", "note": f"Oxygen level healthy ({spo2:.1f}%)"}

def score_temperature(temp):
    try:
        temp = float(temp)
    except:
        return {"score": 20, "level": "unknown", "note": "Temperature unreadable"}
    if temp > 39.5:
        return {"score": 90, "level": "High",   "note": f"High fever ({temp:.1f}°C)"}
    if temp > 38.5:
        return {"score": 70, "level": "High",   "note": f"Fever present ({temp:.1f}°C)"}
    if temp > 38.0:
        return {"score": 50, "level": "Medium", "note": f"Elevated temperature ({temp:.1f}°C)"}
    if temp < 35.5:
        return {"score": 75, "level": "High",   "note": f"Hypothermia risk ({temp:.1f}°C)"}
    return {"score": 5, "level": "Low", "note": f"Temperature normal ({temp:.1f}°C)"}

def score_lifestyle(activity, smoking, alcohol, bmi):
    act_map  = {"sedentary":40,"inactive":40,"none":40,"low":25,"light":25,"moderate":10,"regular":10,"active":5,"high":5,"very_active":3,"athlete":3}
    smk_map  = {"no":0,"none":0,"never":0,"non-smoker":0,"occasional":25,"social":20,"regular":55,"yes":55,"smoker":55,"heavy":80}
    alc_map  = {"no":0,"none":0,"never":0,"occasional":15,"social":10,"light":10,"regular":35,"moderate":30,"yes":35,"heavy":65}
    a = act_map.get(str(activity).strip().lower(), 20)
    s = smk_map.get(str(smoking).strip().lower(), 0)
    al = alc_map.get(str(alcohol).strip().lower(), 0)
    score = a*0.35 + s*0.35 + al*0.2
    notes = []
    if a >= 30: notes.append(f"Low physical activity ({activity})")
    if s >= 50: notes.append(f"Smoking habit detected ({smoking})")
    elif s >= 20: notes.append("Occasional smoking noted")
    if al >= 30: notes.append("Regular alcohol consumption")
    if bmi:
        try:
            b = float(bmi)
            if b > 35:   score += 20; notes.append(f"Severely high BMI ({b:.1f})")
            elif b > 30: score += 12; notes.append(f"High BMI ({b:.1f})")
            elif b > 25: score += 5
            elif b < 16: score += 20; notes.append(f"Very low BMI ({b:.1f})")
            elif b < 18.5: score += 8; notes.append(f"Low BMI ({b:.1f})")
        except: pass
    return {
        "score": min(100, round(score)),
        "level": "High" if score > 60 else ("Medium" if score > 30 else "Low"),
        "notes": notes or ["Lifestyle factors acceptable"]
    }

def calculate_risk(raw_record):
    rec = normalize_record(raw_record)
    age      = rec.get("age")
    hr       = rec.get("heart_rate")
    spo2     = rec.get("spo2")
    temp     = rec.get("temperature")
    activity = rec.get("activity_level", "moderate")
    smoking  = rec.get("smoking", "no")
    alcohol  = rec.get("alcohol", "no")
    bmi      = rec.get("bmi")

    if not all([hr, spo2, temp]):
        raise ValueError("Missing required: heart_rate, spo2, temperature")

    hr_r   = score_heart_rate(hr, age)
    spo2_r = score_spo2(spo2)
    temp_r = score_temperature(temp)
    life_r = score_lifestyle(activity, smoking, alcohol, bmi)

    final = max(0, min(100, round(0.30*hr_r["score"] + 0.30*spo2_r["score"] + 0.20*temp_r["score"] + 0.20*life_r["score"])))
    level = "High" if final >= 65 else ("Medium" if final >= 35 else "Low")
    color = {"High":"#E24B4A","Medium":"#EF9F27","Low":"#3B9B5E"}[level]

    issues = []
    for result, label in [(hr_r,"Heart Rate"),(spo2_r,"SpO₂"),(temp_r,"Temperature")]:
        if result["level"] in ("High","Medium"):
            issues.append({"label":label,"note":result["note"],"level":result["level"]})
    for note in life_r["notes"]:
        if life_r["level"] in ("High","Medium"):
            issues.append({"label":"Lifestyle","note":note,"level":life_r["level"]})
    if not issues:
        issues.append({"label":"General","note":"All vitals within healthy range","level":"Low"})

    suggestions = []
    try:
        if float(hr) > 100: suggestions.append("🫀 Reduce caffeine and practice deep breathing to lower heart rate.")
        if float(spo2) < 95: suggestions.append("🫁 Practice diaphragmatic breathing. Consult a doctor if SpO₂ stays below 95%.")
        if float(temp) > 38.0: suggestions.append("🌡️ Stay hydrated and rest. Seek medical attention if fever persists.")
    except: pass
    if str(smoking).lower() in ["regular","heavy","yes"]: suggestions.append("🚭 Consider a smoking cessation program — it significantly reduces cardiovascular risk.")
    if str(alcohol).lower() in ["regular","heavy"]: suggestions.append("🍷 Aim for fewer than 14 alcohol units per week.")
    if str(activity).lower() in ["sedentary","low","inactive","none"]: suggestions.append("🏃 30 minutes of moderate exercise 5 days/week can dramatically reduce risk.")
    if bmi:
        try:
            b = float(bmi)
            if b > 30: suggestions.append(f"⚖️ BMI of {b:.1f} is in the obese range. A structured diet + exercise plan can help.")
            elif b < 18.5: suggestions.append(f"⚖️ BMI of {b:.1f} suggests underweight. Consult a nutritionist.")
        except: pass
    if not suggestions:
        suggestions.append("✅ Great vitals! Maintain current habits and schedule annual checkups.")

    return {
        "risk_score": final,
        "risk_level": level,
        "risk_color": color,
        "component_scores": {"heart_rate":hr_r,"spo2":spo2_r,"temperature":temp_r,"lifestyle":life_r},
        "issues": issues,
        "suggestions": suggestions,
        "vitals": {"age":age,"heart_rate":hr,"spo2":spo2,"temperature":temp,
                   "activity_level":activity,"smoking":smoking,"alcohol":alcohol,"bmi":bmi}
    }

def extract_fields_from_text(text):
    records = []
    blocks = re.split(r"(?i)patient\s*[:\-#]?\s*\d+|---+|===+", text)
    if len(blocks) <= 1: blocks = [text]
    patterns = {
        "patient_id": r"(?:patient\s*(?:id|no|name)?[:\s]+)([A-Za-z0-9_\- ]+)",
        "age":        r"(?:age|years)[:\s]+(\d{1,3})",
        "heart_rate": r"(?:heart\s*rate|hr|pulse|bpm)[:\s]+(\d{2,3})",
        "spo2":       r"(?:spo2?|oxygen(?:\s*level)?|o2)[:\s%]+(\d{2,3}(?:\.\d)?)",
        "temperature":r"(?:temp(?:erature)?)[:\s]+(\d{2}(?:\.\d{1,2})?)",
        "bmi":        r"(?:bmi)[:\s]+(\d{2}(?:\.\d{1,2})?)",
        "smoking":    r"(?:smoking|smoker)[:\s]+(\w+)",
        "alcohol":    r"(?:alcohol|drinking)[:\s]+(\w+)",
        "activity_level": r"(?:activity(?:\s*level)?|exercise)[:\s]+(\w+(?:\s*\w+)?)",
    }
    for block in blocks:
        rec = {}
        for field, pat in patterns.items():
            m = re.search(pat, block, re.IGNORECASE)
            if m: rec[field] = m.group(1).strip()
        if any(k in rec for k in ["heart_rate","spo2","temperature"]):
            records.append(rec)
    return records
