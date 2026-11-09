import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('recovery',Path(__file__).with_name('recognize-quickstep-anr.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
XML='''<hierarchy><node package="android" resource-id="android:id/alertTitle" text="Quickstep isn't responding"/><node package="android" resource-id="android:id/aerr_close" clickable="true" enabled="true" bounds="[70,1143][1010,1269]"/><node package="android" resource-id="android:id/aerr_wait" clickable="true" enabled="true" bounds="[70,1269][1010,1395]"/></hierarchy>'''
LOG='ANR in com.android.launcher3 (com.android.launcher3/.uioverrides.QuickstepLauncher)'
class Recovery(unittest.TestCase):
 def test_selects_close_not_wait(self):self.assertEqual(m.close_target(XML,LOG),(540,1206))
 def test_refuses_application_anr(self):self.assertIsNone(m.close_target(XML,LOG+'\nANR in com.osminog.vision'))
 def test_refuses_application_crash(self):self.assertIsNone(m.close_target(XML,LOG+'\nProcess: com.osminog.vision, PID: 123'))
 def test_requires_log_evidence(self):self.assertIsNone(m.close_target(XML,''))
 def test_requires_exact_system_dialog(self):self.assertIsNone(m.close_target(XML.replace('Quickstep','OSMINOG'),LOG));self.assertIsNone(m.close_target(XML.replace('package="android"','package="com.osminog.vision"'),LOG))
 def test_refuses_ambiguous_or_missing_button(self):self.assertIsNone(m.close_target(XML.replace('aerr_close','aerr_wait'),LOG));self.assertIsNone(m.close_target(XML.replace('[70,1143][1010,1269]','bad'),LOG))
if __name__=='__main__':unittest.main()
