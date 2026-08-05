-- One-time data enrichment: populate `category` and `manufacturer` on the
-- equipment table. Neither field exists in the source Excel register, so
-- this is added knowledge, not re-derived from it (unlike schema.sql /
-- seed_data.sql, which stay strictly faithful to the source file).
--
-- category: a measurement-domain taxonomy grouping the 18 real equipment
-- names into 6 categories, chosen by the assistant -- an organizational
-- judgment call, not a factual claim, and freely renameable later via the
-- Equipment edit screen.
--
-- manufacturer: populated ONLY where the model name makes it unambiguous
-- (e.g. "Fluke-717" -> Fluke) or the product is a well-known, distinctively
-- named item in the biomedical calibration industry (e.g. "CITREX H5" ->
-- IMT Analytics). Left NULL wherever genuinely uncertain (Decade Resistor,
-- Fetal Simulator PS320, Steel Weight, Digital Pressure Gauge with no
-- model) rather than guessing -- verify those against the physical
-- nameplate or purchase record.

USE mcems;

-- ---------------------------------------------------------------------
-- Category
-- ---------------------------------------------------------------------
UPDATE equipment SET category = 'Electrical Safety'
  WHERE name IN ('Electrical Safety Analyzer', 'True RMS Multimeter', 'Decade Resistor');

UPDATE equipment SET category = 'Pressure & Flow'
  WHERE name IN ('Pressure Calibrator', 'Digital Pressure Gauge', 'Gas Flow Analyzer');

UPDATE equipment SET category = 'Patient Simulators & Analyzers'
  WHERE name IN ('Vital Signs Simulator', 'ECG Simulator', 'Fetal Simulator',
                  'Defibrillator/Transcutanreous Analyzer', 'Infusion Analyzer',
                  'Incubator/Radiant Warmer Analyzer');

UPDATE equipment SET category = 'Temperature'
  WHERE name IN ('Digital Thermometer withThermocople Type K', 'FFW Tempcheck', 'Hotline Tempcheck');

UPDATE equipment SET category = 'Radiography & Photometry'
  WHERE name IN ('kVp Meter', 'BilBlanket Light Meter');

UPDATE equipment SET category = 'Mass / Weight Standards'
  WHERE name = 'Steel Weight';

-- ---------------------------------------------------------------------
-- Manufacturer -- confident inferences only
-- ---------------------------------------------------------------------
UPDATE equipment SET manufacturer = 'Fluke'
  WHERE name = 'True RMS Multimeter' AND model IN ('Fluke-115', 'Fluke-116', 'Fluke-179');

UPDATE equipment SET manufacturer = 'Fluke'
  WHERE name = 'Pressure Calibrator' AND model = 'Fluke-717 30G';

UPDATE equipment SET manufacturer = 'Fluke'
  WHERE name = 'Digital Thermometer withThermocople Type K' AND model = 'Fluke 51 II with Probe';

UPDATE equipment SET manufacturer = 'Fluke Biomedical'
  WHERE name = 'Electrical Safety Analyzer' AND model IN ('ESA612', 'ESA620');

UPDATE equipment SET manufacturer = 'Fluke Biomedical'
  WHERE name = 'Vital Signs Simulator' AND model IN ('Prosim4', 'Prosim8');

UPDATE equipment SET manufacturer = 'Fluke Biomedical'
  WHERE name = 'Infusion Analyzer' AND model = 'IDA-1S';

UPDATE equipment SET manufacturer = 'Fluke Biomedical'
  WHERE name = 'Incubator/Radiant Warmer Analyzer' AND model = 'INCU II';

UPDATE equipment SET manufacturer = 'Fluke Biomedical'
  WHERE name = 'Defibrillator/Transcutanreous Analyzer' AND model = 'Impulse7000DP';

UPDATE equipment SET manufacturer = 'Fluke Biomedical'
  WHERE name = 'Gas Flow Analyzer' AND model = 'VT650';

UPDATE equipment SET manufacturer = 'IMT Analytics'
  WHERE name = 'Gas Flow Analyzer' AND model = 'CITREX H5';

UPDATE equipment SET manufacturer = 'RTI Group (Unfors RaySafe)'
  WHERE name = 'kVp Meter' AND model = 'Piranha 557';

UPDATE equipment SET manufacturer = 'Netech Corporation'
  WHERE name = 'ECG Simulator' AND model = 'MiniSim';

UPDATE equipment SET manufacturer = 'BC Group International'
  WHERE name = 'FFW Tempcheck' AND model = 'DSTA-40';

UPDATE equipment SET manufacturer = 'BC Group International'
  WHERE name = 'Hotline Tempcheck' AND model = 'HLTA-40';

-- Already recorded in the source data's model column -- relocating it to
-- the correct field, not inventing a new fact.
UPDATE equipment SET manufacturer = 'Ohmeda Medical'
  WHERE name = 'BilBlanket Light Meter' AND model = 'Ohmeda Medical';

-- Deliberately left NULL (genuinely uncertain, per the confirmed plan):
--   Decade Resistor / RS-200
--   Fetal Simulator / PS320
--   Digital Pressure Gauge / N/A
--   Steel Weight / Class M1  (an OIML accuracy class, not a brand)
