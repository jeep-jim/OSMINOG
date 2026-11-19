"""In-flight consent regression tests; only local fake model transport."""
import unittest
import test_reg_ai as ai

class TestConsentRevocation(unittest.TestCase):
    setUp = ai.TestAIBoundary.setUp
    tearDown = ai.TestAIBoundary.tearDown
    register = ai.TestAIBoundary.register
    intent = ai.TestAIBoundary.intent
    enable = ai.TestAIBoundary.enable
    install = ai.TestAIBoundary.install
    match = ai.TestAIBoundary.match

    def test_query_consent_revocation_during_request_returns_only_lexical(self):
        def revoke():
            status, _ = self.a.call('/api/profile', {'name':'Alice','avatar':'plankton','ai_consent':False})
            self.assertEqual(status, 200)
        self.install(revoke); self.enable(self.a); self.enable(self.b)
        own = self.intent(self.a, 'Ищу ушанку', 'seek')
        self.intent(self.b, 'Отдам зимний головной убор', 'offer')
        status, result = self.match(own)
        self.assertEqual(status, 200)
        self.assertEqual(result['mode'], 'lexical')
        self.assertEqual(result['items'], [])
        self.assertEqual(result['ai_state'], 'consent_required')
        self.match(own)
        self.assertEqual(len(self.requests), 1)

    def test_candidate_consent_revocation_during_request_excludes_ai_result(self):
        def revoke():
            status, _ = self.b.call('/api/profile', {'name':'Boris','avatar':'plankton','ai_consent':False})
            self.assertEqual(status, 200)
        self.install(revoke); self.enable(self.a); self.enable(self.b)
        own = self.intent(self.a, 'Ищу ушанку', 'seek')
        self.intent(self.b, 'Отдам зимний головной убор', 'offer')
        status, result = self.match(own)
        self.assertEqual(status, 200)
        self.assertEqual(result['items'], [])
        self.match(own)
        self.assertEqual(len(self.requests), 1)

if __name__ == '__main__':
    unittest.main()
