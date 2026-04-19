export type MetricStatus = 'ok' | 'amber' | 'red' | 'unknown';

export interface HelpLink {
  title: string;
  url: string;
}

export interface StatusDisplay {
  badge: string;
  badgeClass: 'ok' | 'amber' | 'red';
  pathway: string;
  meaning: string;
  helpLinks: HelpLink[];
}

export interface MetricDefinition {
  id: string;
  label: string;
  unit?: string;
  whatTitle: string;
  what: string;  // Brief educational section (NHS reading age 9-11)
  statuses: Record<Exclude<MetricStatus, 'unknown'>, StatusDisplay>;
}

export interface ParsedMetric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  what: string;
  whatTitle: string;
  resultCode?: string;
  resultDate?: string;
  /**
   * Optional breakdown values (used for the shared cholesterol card).
   */
  components?: {
    hdl?: string;
    ldl?: string;
    tc?: string;
  };
  status: MetricStatus;
  badge: string;
  badgeClass: 'ok' | 'amber' | 'red';
  pathway: string;
  meaning: string;
  helpLinks: HelpLink[];
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  bp: {
    id: 'bp',
    label: 'Blood Pressure (BP)',
    unit: 'mmHg',
    whatTitle: 'What is blood pressure?',
    what: 'Blood pressure measures the force of blood pushing against your artery walls as your heart pumps. It\'s recorded as two numbers - the top one is when your heart beats, the bottom one is when it rests. Healthy blood pressure helps your heart work well and keeps you healthy.',
    statuses: {
      ok: {
        badge: 'HEALTHY', badgeClass: 'ok',
        pathway: 'Your blood pressure is within a healthy range. Continue with your current lifestyle.',
        meaning: 'Blood pressure measures the force of blood pushing against your artery walls. It is recorded as two numbers — systolic (when your heart beats) over diastolic (when it rests). A healthy reading is below 130/80 mmHg. Your result shows your heart and circulation are working well.',
        helpLinks: [
          { title: 'Understanding blood pressure', url: 'https://www.nhs.uk/conditions/high-blood-pressure-hypertension/' },
          { title: 'Keep your heart healthy', url: 'https://www.bhf.org.uk/informationsupport/risk-factors/high-blood-pressure' },
        ],
      },
      amber: {
        badge: 'AMBER', badgeClass: 'amber',
        pathway: 'Your blood pressure is slightly raised. Reduce salt intake and re-test in 2 weeks.',
        meaning: 'Your blood pressure is above the ideal range (130/80 mmHg) but not yet at a level that requires immediate medication. This is sometimes called "elevated" or "stage 1 hypertension". Left untreated, raised blood pressure increases your risk of heart attack and stroke over time — but small lifestyle changes can make a real difference.',
        helpLinks: [
          { title: 'How to lower blood pressure without medication', url: 'https://www.nhs.uk/conditions/high-blood-pressure-hypertension/prevention/' },
          { title: 'Blood Pressure UK — diet and lifestyle advice', url: 'https://www.bloodpressureuk.org/your-blood-pressure/how-to-lower-your-blood-pressure/' },
          { title: 'NHS DASH diet guidance', url: 'https://www.nhs.uk/live-well/eat-well/how-to-eat-a-balanced-diet/' },
        ],
      },
      red: {
        badge: 'HIGH', badgeClass: 'red',
        pathway: 'Your blood pressure is high and needs attention. Follow the advice provided with your health check.',
        meaning: 'Your blood pressure reading is significantly above normal (above 140/90 mmHg). This is known as hypertension and is a major risk factor for heart attack, stroke, and kidney disease. The good news is that it can be treated effectively — either through lifestyle changes, medication, or both. Please do not ignore this result.',
        helpLinks: [
          { title: 'High blood pressure — treatment options', url: 'https://www.nhs.uk/conditions/high-blood-pressure-hypertension/treatment/' },
          { title: 'Blood Pressure Association support', url: 'https://www.bloodpressureuk.org' },
        ],
      },
    },
  },

  bmi: {
    id: 'bmi',
    label: 'Body Mass Index (BMI)',
    unit: 'kg/m²',
    whatTitle: 'What is BMI?',
    what: 'BMI compares your weight to your height to see if your weight is healthy. It\'s calculated using a simple formula. A healthy BMI means your weight is not putting extra strain on your heart and body.',
    statuses: {
      ok: {
        badge: 'HEALTHY', badgeClass: 'ok',
        pathway: 'Your BMI is within the healthy range. Keep up your current diet and activity levels.',
        meaning: 'BMI is a measure of whether your weight is appropriate for your height. It is calculated by dividing your weight in kilograms by your height in metres squared. A healthy BMI is between 18.5 and 24.9. Your result suggests your weight is not posing a risk to your health.',
        helpLinks: [
          { title: 'Check your BMI — NHS calculator', url: 'https://www.nhs.uk/live-well/healthy-weight/bmi-calculator/' },
          { title: 'Maintaining a healthy weight', url: 'https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/' },
        ],
      },
      amber: {
        badge: 'OVERWEIGHT', badgeClass: 'amber',
        pathway: 'Your BMI indicates you are overweight. Referral to a local NHS weight management group is available.',
        meaning: 'A BMI of 25–29.9 is classed as overweight. This means your weight is putting extra strain on your heart, joints, and metabolism, and increases your risk of type 2 diabetes, high blood pressure, and some cancers. Losing just 5–10% of your body weight can significantly reduce these risks.',
        helpLinks: [
          { title: 'NHS Weight Loss Plan (free 12-week plan)', url: 'https://www.nhs.uk/live-well/healthy-weight/managing-your-weight/nhs-weight-loss-plan/' },
          { title: 'Better Health — lose weight', url: 'https://www.nhs.uk/better-health/lose-weight/' },
          { title: 'Find a local weight management service', url: 'https://www.nhs.uk/service-search/other-services/weight-management-services/locationsearch/1119' },
        ],
      },
      red: {
        badge: 'OBESE', badgeClass: 'red',
        pathway: 'Your BMI indicates obesity, which is significantly affecting your health. Support is available to help with weight management.',
        meaning: 'A BMI of 30 or above is classed as obese. This significantly increases your risk of serious conditions including type 2 diabetes, heart disease, stroke, joint problems, and certain cancers. This is not about appearance — it is a medical concern. Specialist support and effective treatments are available.',
        helpLinks: [
          { title: 'Obesity — treatment and support', url: 'https://www.nhs.uk/conditions/obesity/' },
          { title: 'Tier 3 weight management services', url: 'https://www.nhs.uk/service-search/other-services/weight-management-services/locationsearch/1119' },
          { title: 'Mind and body — emotional support for weight', url: 'https://www.mind.org.uk/information-support/tips-for-everyday-living/physical-activity-and-your-mental-health/' },
        ],
      },
    },
  },

  cvd: {
    id: 'cvd',
    label: 'CVD Risk (10yr)',
    unit: '%',
    whatTitle: 'What is QRisk?',
    what: 'Your CVD risk score is an estimate of your chances of having a heart attack or stroke in the next 10 years. It looks at factors like your age, blood pressure, cholesterol, and whether you smoke. A lower number is better.',
    statuses: {
      ok: {
        badge: 'LOW RISK', badgeClass: 'ok',
        pathway: 'Maintain your current active lifestyle and healthy diet. Re-check at your next NHS Health Check.',
        meaning: 'Your 10-year cardiovascular risk score estimates the likelihood of you having a heart attack or stroke in the next 10 years, based on factors like your age, blood pressure, cholesterol, and whether you smoke. A score below 10% is considered low risk. Your result is reassuring — keep doing what you\'re doing.',
        helpLinks: [
          { title: 'What is cardiovascular disease?', url: 'https://www.nhs.uk/conditions/cardiovascular-disease/' },
          { title: 'Heart health lifestyle tips', url: 'https://www.bhf.org.uk/informationsupport/support/healthy-living' },
        ],
      },
      amber: {
        badge: 'MODERATE', badgeClass: 'amber',
        pathway: 'Your cardiovascular risk is moderate. Discuss cholesterol-lowering medication and lifestyle changes with your GP.',
        meaning: 'A CVD risk score of 10–20% means you have a moderate chance of a heart attack or stroke in the next 10 years. This is not an immediate emergency, but it is important to take action now. The score combines several risk factors — improving even one (e.g. quitting smoking, losing weight, or reducing blood pressure) can substantially lower your overall risk.',
        helpLinks: [
          { title: 'Reducing your heart disease risk', url: 'https://www.bhf.org.uk/informationsupport/risk-factors' },
          { title: 'Should I take a statin? NHS guidance', url: 'https://www.nhs.uk/conditions/statins/' },
          { title: 'NHS Lifestyle programme referral', url: 'https://www.nhs.uk/better-health/' },
        ],
      },
      red: {
        badge: 'HIGH RISK', badgeClass: 'red',
        pathway: 'Your cardiovascular risk is high. Please book a GP appointment to discuss treatment options as soon as possible.',
        meaning: 'A CVD risk score above 20% means you have a high probability of experiencing a heart attack or stroke within the next 10 years. This requires active management. Your GP will likely discuss starting medication (such as statins or blood pressure treatment) alongside lifestyle changes. This risk is not inevitable — effective treatments can significantly reduce it.',
        helpLinks: [
          { title: 'Heart attack — know the signs', url: 'https://www.bhf.org.uk/informationsupport/conditions/heart-attack' },
          { title: 'Statins — what you need to know', url: 'https://www.nhs.uk/conditions/statins/' },
          { title: 'Book a GP appointment urgently', url: 'https://www.nhs.uk/nhs-services/gps/' },
        ],
      },
    },
  },

  ldl: {
    id: 'ldl',
    label: 'LDL Cholesterol',
    unit: 'mmol/L',
    whatTitle: 'What is cholesterol?',
    what: 'LDL is a type of cholesterol called "bad" cholesterol because too much of it can build up inside your arteries like plaque, making them narrower. This increases your risk of heart attacks and strokes.',
    statuses: {
      ok: {
        badge: 'HEALTHY', badgeClass: 'ok',
        pathway: 'Your LDL cholesterol is within a healthy range. Keep up the balanced diet.',
        meaning: 'LDL (low-density lipoprotein) is often called "bad" cholesterol because high levels lead to a build-up of fatty deposits in your arteries, increasing the risk of heart attack and stroke. Your level is within the healthy range, which is great news for your heart health.',
        helpLinks: [
          { title: 'Cholesterol — what it is', url: 'https://www.nhs.uk/conditions/high-cholesterol/about/' },
          { title: 'Heart-healthy diet tips', url: 'https://www.bhf.org.uk/informationsupport/support/healthy-living/healthy-eating' },
        ],
      },
      amber: {
        badge: 'BORDERLINE', badgeClass: 'amber',
        pathway: 'Your LDL is slightly raised. Reduce saturated fats and eat more fibre. Re-check in 3 months.',
        meaning: 'Your LDL cholesterol is slightly above the ideal level. Over time, elevated LDL can cause fatty plaques to build up inside your arteries, narrowing them and raising your risk of heart disease. Diet changes — particularly cutting saturated fat (found in butter, fatty meat, and cheese) and eating more soluble fibre — are proven to reduce LDL.',
        helpLinks: [
          { title: 'Foods that lower cholesterol', url: 'https://www.bhf.org.uk/informationsupport/heart-matters-magazine/nutrition/5-top-foods-to-lower-cholesterol' },
          { title: 'Heart UK — cholesterol helpline', url: 'https://www.heartuk.org.uk/cholesterol' },
          { title: 'NHS cholesterol diet guide', url: 'https://www.nhs.uk/conditions/high-cholesterol/cholesterol-lowering-foods/' },
        ],
      },
      red: {
        badge: 'HIGH', badgeClass: 'red',
        pathway: 'Your LDL cholesterol is high. Please discuss cholesterol medication (statins) with your GP.',
        meaning: 'Your LDL cholesterol is significantly elevated. This is a major risk factor for coronary heart disease and stroke. At this level, diet changes alone are often insufficient — your GP will likely discuss starting a statin, which is a safe and well-evidenced medication that can reduce LDL by 30–50%. Combined with lifestyle changes, this can substantially lower your heart disease risk.',
        helpLinks: [
          { title: 'High cholesterol — treatment', url: 'https://www.nhs.uk/conditions/high-cholesterol/treatment/' },
          { title: 'Statins explained', url: 'https://www.nhs.uk/conditions/statins/' },
          { title: 'Heart UK specialist support', url: 'https://www.heartuk.org.uk' },
        ],
      },
    },
  },

  nhdl: {
    id: 'nhdl',
    label: 'Non-HDL Cholesterol',
    unit: 'mmol/L',
    whatTitle: 'What is cholesterol?',
    what: 'Non-HDL cholesterol is all the harmful cholesterol in your blood added together. It includes LDL and other types. It\'s considered a better way to measure your heart disease risk than just LDL alone.',
    statuses: {
      ok: {
        badge: 'HEALTHY', badgeClass: 'ok',
        pathway: 'Your non-HDL cholesterol is healthy. Continue with a balanced diet.',
        meaning: 'Non-HDL cholesterol is the total of all the "bad" forms of cholesterol in your blood (everything except HDL, which is "good" cholesterol). It is considered a better overall predictor of cardiovascular risk than LDL alone. Your level is within the healthy range.',
        helpLinks: [
          { title: 'Understanding your cholesterol results', url: 'https://www.nhs.uk/conditions/high-cholesterol/about/' },
          { title: 'Heart UK cholesterol guide', url: 'https://www.heartuk.org.uk/cholesterol' },
        ],
      },
      amber: {
        badge: 'BORDERLINE', badgeClass: 'amber',
        pathway: 'Your non-HDL cholesterol is borderline. Focus on diet changes and re-test in 3 months.',
        meaning: 'Your non-HDL cholesterol is above the recommended level of 4 mmol/L. This means there is more potentially harmful cholesterol circulating in your blood than ideal. This is often related to diet and lifestyle. Making changes now can prevent it progressing to a level that requires medication.',
        helpLinks: [
          { title: 'Cholesterol-lowering diet', url: 'https://www.nhs.uk/conditions/high-cholesterol/cholesterol-lowering-foods/' },
          { title: 'Heart UK — dietary advice', url: 'https://www.heartuk.org.uk/low-cholesterol-foods' },
          { title: 'NHS Better Health — eat well', url: 'https://www.nhs.uk/better-health/eat-better/' },
        ],
      },
      red: {
        badge: 'HIGH', badgeClass: 'red',
        pathway: 'Your non-HDL cholesterol is high. Discuss treatment options with your GP.',
        meaning: 'Your non-HDL cholesterol is significantly raised, which substantially increases your risk of cardiovascular disease. At this level, a combination of medication (statins or other cholesterol-lowering drugs) and dietary changes is usually recommended. Your GP will assess the best approach based on your overall health profile.',
        helpLinks: [
          { title: 'High cholesterol — when to get help', url: 'https://www.nhs.uk/conditions/high-cholesterol/' },
          { title: 'Heart UK specialist helpline', url: 'https://www.heartuk.org.uk/get-help/helpline' },
          { title: 'Statins — benefits and side effects', url: 'https://www.nhs.uk/conditions/statins/' },
        ],
      },
    },
  },

  tc: {
    id: 'tc',
    label: 'Total Cholesterol',
    unit: 'mmol/L',
    whatTitle: 'What is cholesterol?',
    what: 'Total cholesterol is the combined amount of all types of cholesterol in your blood - the bad kind (LDL), the good kind (HDL), and others. Your body needs some cholesterol, but too much increases heart disease risk.',
    statuses: {
      ok: {
        badge: 'HEALTHY', badgeClass: 'ok',
        pathway: 'Your total cholesterol is within the healthy range. Keep up the balanced diet.',
        meaning: 'Total cholesterol is the sum of all types of cholesterol in your blood, including LDL ("bad"), HDL ("good"), and others. A level below 5 mmol/L is generally healthy. Your reading is reassuring and suggests a good balance of cholesterol in your blood.',
        helpLinks: [
          { title: 'Cholesterol — the full picture', url: 'https://www.nhs.uk/conditions/high-cholesterol/about/' },
          { title: 'Heart-healthy eating', url: 'https://www.bhf.org.uk/informationsupport/support/healthy-living/healthy-eating' },
        ],
      },
      amber: {
        badge: 'BORDERLINE', badgeClass: 'amber',
        pathway: 'Your total cholesterol is borderline high. Review your diet and consider re-testing in 3 months.',
        meaning: 'A total cholesterol between 5 and 6.5 mmol/L is considered borderline. While not immediately dangerous, it suggests your diet and lifestyle may be contributing to an increased risk of heart disease over time. Focusing on reducing saturated fat, increasing exercise, and eating more fibre can bring this back into the healthy range.',
        helpLinks: [
          { title: 'How to lower your cholesterol', url: 'https://www.nhs.uk/conditions/high-cholesterol/cholesterol-lowering-foods/' },
          { title: 'NHS Eatwell guide', url: 'https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/the-eatwell-guide/' },
          { title: 'Heart UK recipe ideas', url: 'https://www.heartuk.org.uk/low-cholesterol-foods/recipes' },
        ],
      },
      red: {
        badge: 'HIGH', badgeClass: 'red',
        pathway: 'Your total cholesterol is high. Please discuss with your GP — medication may be appropriate.',
        meaning: 'A total cholesterol above 6.5 mmol/L is considered high and significantly increases your cardiovascular risk. Fatty deposits can build up in your arteries over years without symptoms, until a heart attack or stroke occurs. Your GP can assess whether medication is needed alongside dietary changes.',
        helpLinks: [
          { title: 'High cholesterol — what happens if untreated', url: 'https://www.nhs.uk/conditions/high-cholesterol/' },
          { title: 'Cholesterol medication options', url: 'https://www.nhs.uk/conditions/high-cholesterol/treatment/' },
          { title: 'Heart UK helpline', url: 'https://www.heartuk.org.uk/get-help/helpline' },
        ],
      },
    },
  },

  hba1c: {
    id: 'hba1c',
    label: 'HbA1c (Blood Sugar)',
    unit: 'mmol/mol',
    whatTitle: 'What is HbA1c?',
    what: 'HbA1c measures your average blood sugar levels over the last 2-3 months. Glucose sticks to your red blood cells, and this test shows how much is sticking. A healthy level means your body is managing blood sugar well.',
    statuses: {
      ok: {
        badge: 'HEALTHY', badgeClass: 'ok',
        pathway: 'Your blood sugar levels are within the normal range.',
        meaning: 'HbA1c measures your average blood sugar levels over the past 2–3 months. It reflects how much glucose is sticking to your red blood cells. A level below 42 mmol/mol is normal. Your result means your body is managing blood sugar well and you do not currently show signs of diabetes or pre-diabetes.',
        helpLinks: [
          { title: 'What is HbA1c?', url: 'https://www.diabetes.org.uk/guide-to-diabetes/managing-your-diabetes/hba1c' },
          { title: 'Healthy eating to maintain blood sugar', url: 'https://www.nhs.uk/live-well/eat-well/' },
        ],
      },
      amber: {
        badge: 'PRE-DIABETES', badgeClass: 'amber',
        pathway: 'Your HbA1c is in the pre-diabetes range. You have been referred to the NHS Diabetes Prevention Programme.',
        meaning: 'An HbA1c of 42–47 mmol/mol is called pre-diabetes (or non-diabetic hyperglycaemia). Your blood sugar is higher than normal but not yet high enough to be diagnosed as diabetes. This is a serious warning sign, but it is also highly reversible — research shows that losing weight and increasing activity can return levels to normal and prevent progression to type 2 diabetes.',
        helpLinks: [
          { title: 'NHS Diabetes Prevention Programme', url: 'https://www.england.nhs.uk/diabetes/diabetes-prevention/' },
          { title: 'Pre-diabetes — what it means', url: 'https://www.diabetes.org.uk/diabetes-the-basics/types-of-diabetes/type-2/pre-diabetes' },
          { title: 'Diabetes UK — getting support', url: 'https://www.diabetes.org.uk/how_we_help/helpline' },
        ],
      },
      red: {
        badge: 'DIABETIC RANGE', badgeClass: 'red',
        pathway: 'Your HbA1c suggests diabetes. Your GP will contact you to arrange further tests and discuss treatment.',
        meaning: 'An HbA1c of 48 mmol/mol or above indicates type 2 diabetes. This means your body is not managing blood sugar effectively, which over time can damage nerves, blood vessels, kidneys, and eyes. A second test is usually done to confirm the diagnosis. Type 2 diabetes is a serious but manageable condition — early treatment significantly reduces the risk of complications.',
        helpLinks: [
          { title: 'Newly diagnosed with type 2 diabetes', url: 'https://www.diabetes.org.uk/diabetes-the-basics/types-of-diabetes/type-2' },
          { title: 'Diabetes UK helpline: 0345 123 2399', url: 'https://www.diabetes.org.uk/how_we_help/helpline' },
          { title: 'NHS diabetes education programmes', url: 'https://www.england.nhs.uk/diabetes/structured-education/' },
        ],
      },
    },
  },

  act: {
    id: 'act',
    label: 'Physical Activity',
    unit: '',
    whatTitle: 'What is physical activity?',
    what: 'Physical activity means any movement that makes your heart beat faster and gets you a bit out of breath. This includes brisk walking, cycling, swimming, or sports. Regular activity strengthens your heart and helps prevent many diseases.',
    statuses: {
      ok: {
        badge: 'ACTIVE', badgeClass: 'ok',
        pathway: 'You are meeting the recommended 150 minutes of activity per week. Keep it up!',
        meaning: 'UK guidelines recommend at least 150 minutes of moderate-intensity activity per week (such as brisk walking, cycling, or swimming). You are meeting this target, which significantly reduces your risk of heart disease, type 2 diabetes, cancer, depression, and dementia. Physical activity is one of the most powerful things you can do for your health.',
        helpLinks: [
          { title: 'NHS exercise guidelines', url: 'https://www.nhs.uk/live-well/exercise/exercise-guidelines/physical-activity-guidelines-for-adults-aged-19-to-64/' },
          { title: 'Sport England — activities near you', url: 'https://www.sportengland.org/jointhemovement' },
        ],
      },
      amber: {
        badge: 'LOW', badgeClass: 'amber',
        pathway: 'You are below the recommended 150 minutes of activity per week. Try adding short walks to your daily routine.',
        meaning: 'You are currently not reaching the recommended 150 minutes of moderate activity per week. Physical inactivity is one of the leading risk factors for heart disease, type 2 diabetes, and mental health problems. The good news is that even small increases — such as a 10-minute brisk walk three times a day — can make a measurable difference to your health.',
        helpLinks: [
          { title: 'NHS — how to get active', url: 'https://www.nhs.uk/live-well/exercise/get-active-your-way/why-we-should-sit-less/' },
          { title: 'Couch to 5K — beginner running plan', url: 'https://www.nhs.uk/live-well/exercise/running-and-aerobic-exercises/get-running-with-couch-to-5k/' },
          { title: 'Find local activities with Active Notts', url: 'https://www.activenotts.org.uk' },
        ],
      },
      red: {
        badge: 'INACTIVE', badgeClass: 'red',
        pathway: 'Increasing physical activity would significantly improve your health. Speak to your GP about an exercise referral.',
        meaning: 'You are currently doing very little physical activity. This significantly increases your risk of developing serious health conditions including heart disease, stroke, type 2 diabetes, obesity, and depression. Your GP can refer you to a local exercise programme (exercise on referral) which is supervised and tailored to your needs and fitness level.',
        helpLinks: [
          { title: 'Exercise on referral — NHS scheme', url: 'https://www.nhs.uk/live-well/exercise/get-active-your-way/exercise-referral-schemes/' },
          { title: 'Physical activity for people with health conditions', url: 'https://www.nhs.uk/live-well/exercise/exercise-as-a-treatment-for-various-conditions/' },
          { title: 'Start for Life — gentle activity ideas', url: 'https://www.nhs.uk/live-well/exercise/walking-for-health/' },
        ],
      },
    },
  },

  alc: {
    id: 'alc',
    label: 'Alcohol Use',
    unit: '',
    whatTitle: 'What is alcohol risk?',
    what: 'Alcohol use measures how much alcohol you drink per week. The UK recommends no more than 14 units per week, spread across at least 3 days. Your body handles alcohol better when you have drink-free days.',
    statuses: {
      ok: {
        badge: 'LOW RISK', badgeClass: 'ok',
        pathway: 'Your alcohol intake is within recommended guidelines (under 14 units per week).',
        meaning: 'The UK Chief Medical Officers recommend drinking no more than 14 units of alcohol per week, spread across at least 3 days. 14 units is roughly 6 pints of average-strength beer or 10 small glasses of wine. Your intake is within these guidelines, which means your alcohol use is not currently posing a significant health risk.',
        helpLinks: [
          { title: 'Alcohol units explained', url: 'https://www.nhs.uk/live-well/alcohol-support/calculating-alcohol-units/' },
          { title: 'NHS Drink Free Days app', url: 'https://www.nhs.uk/better-health/drink-less/' },
        ],
      },
      amber: {
        badge: 'AMBER', badgeClass: 'amber',
        pathway: 'Your alcohol intake is above recommended levels. Try to have at least 3 alcohol-free days per week.',
        meaning: 'Drinking above 14 units per week increases your risk of liver disease, high blood pressure, certain cancers, heart problems, and mental health issues. You may not feel any ill effects right now, but the harm is cumulative. Cutting down — even just having more alcohol-free days — can quickly improve your liver function and overall health.',
        helpLinks: [
          { title: 'NHS tips to cut down on alcohol', url: 'https://www.nhs.uk/live-well/alcohol-support/tips-on-cutting-down-alcohol/' },
          { title: 'Drink Coach — free online tool', url: 'https://www.drinkaware.co.uk/tools/drink-coach' },
          { title: 'Talk to Frank — confidential support', url: 'https://www.talktofrank.com/drug/alcohol' },
        ],
      },
      red: {
        badge: 'HIGH RISK', badgeClass: 'red',
        pathway: 'Your alcohol intake is high and affecting your health. Please discuss support options with your GP.',
        meaning: 'Your alcohol use is at a level that is causing or is likely to cause significant harm to your health. Heavy drinking is strongly linked to liver cirrhosis, pancreatitis, heart disease, at least 7 types of cancer, and serious mental health problems. Support is available and non-judgmental — speaking to your GP is a confidential first step.',
        helpLinks: [
          { title: 'Alcohol dependence — getting help', url: 'https://www.nhs.uk/conditions/alcohol-misuse/treatment/' },
          { title: 'Drinkline — free helpline: 0300 123 1110', url: 'https://www.nhs.uk/live-well/alcohol-support/alcohol-support/' },
          { title: 'Alcoholics Anonymous helpline: 0800 9177 650', url: 'https://www.alcoholics-anonymous.org.uk' },
        ],
      },
    },
  },

  smk: {
    id: 'smk',
    label: 'Smoking Status',
    unit: '',
    whatTitle: 'What is smoking status?',
    what: 'Smoking status records whether you currently smoke, used to smoke, or have never smoked. Smoking damages nearly every organ in your body and is the leading cause of preventable death. Quitting at any age brings health benefits.',
    statuses: {
      ok: {
        badge: 'NON-SMOKER', badgeClass: 'ok',
        pathway: 'Well done — not smoking is one of the best things you can do for your health.',
        meaning: 'Not smoking is one of the single most important things you can do for your long-term health. Smoking causes around 70,000 deaths in England each year and is the leading cause of lung cancer, COPD, and heart disease. As a non-smoker, you are already protecting yourself from these risks.',
        helpLinks: [
          { title: 'Smokefree — NHS support', url: 'https://www.nhs.uk/better-health/quit-smoking/' },
          { title: 'Help a friend or family member quit', url: 'https://www.nhs.uk/better-health/quit-smoking/help-someone-else-quit-smoking/' },
        ],
      },
      amber: {
        badge: 'EX-SMOKER', badgeClass: 'amber',
        pathway: 'Well done for quitting. Your health risk continues to fall the longer you stay smoke-free.',
        meaning: 'Quitting smoking is one of the best decisions you can make. Your body starts recovering almost immediately — within 1 year your heart attack risk halves, and within 10–15 years your lung cancer risk approaches that of a non-smoker. The longer you stay smoke-free, the greater the benefit. If you are finding it difficult to stay quit, free NHS support is available.',
        helpLinks: [
          { title: 'Benefits of stopping smoking over time', url: 'https://www.nhs.uk/live-well/quit-smoking/stop-smoking-without-putting-on-weight/' },
          { title: 'Staying smoke-free — NHS tips', url: 'https://www.nhs.uk/better-health/quit-smoking/stop-smoking-tips/' },
          { title: 'Free quit smoking support', url: 'https://www.nhs.uk/better-health/quit-smoking/find-your-local-stop-smoking-service/' },
        ],
      },
      red: {
        badge: 'SMOKER', badgeClass: 'red',
        pathway: 'Stopping smoking is the single best thing you can do for your health. Free NHS support is available — ask your GP.',
        meaning: 'Smoking is the leading preventable cause of death in the UK. It causes lung cancer, COPD, heart attacks, strokes, and many other cancers. On average, smokers die 10 years earlier than non-smokers. But quitting at any age has real benefits — even quitting in your 60s adds years to your life. NHS stop smoking services are proven to be the most effective way to quit and are completely free.',
        helpLinks: [
          { title: 'NHS Stop Smoking Service — free and local', url: 'https://www.nhs.uk/better-health/quit-smoking/find-your-local-stop-smoking-service/' },
          { title: 'Nicotine replacement therapy options', url: 'https://www.nhs.uk/live-well/quit-smoking/using-nicotine-replacement-therapy-nrt/' },
          { title: 'Smokefree app — free quit tracker', url: 'https://www.nhs.uk/better-health/quit-smoking/nhs-smokefree-app/' },
        ],
      },
    },
  },
};

// Display order for the results page
export const METRIC_ORDER = ['bp', 'bmi', 'cvd', 'ldl', 'nhdl', 'tc', 'hba1c', 'act', 'alc', 'smk'];
