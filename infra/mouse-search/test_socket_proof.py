"""Attribution/redaction tests based on observed ss pre/post descriptor close."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location('mouse_socket_proof', Path(__file__).with_name('socket-proof.py'))
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)

OWN = 'ESTAB 0 7335 151.248.113.177:3082 203.0.113.4:45555 users:(("python",pid=39002,fd=5)) uid:1000 ino:736179 sk:9c08432e\n\trto:210 rtt:0.024/0.012 mss:1448 pmtu:1500 bytes_sent:8000 bytes_acked:665 retrans:0/3 unacked:5'
CLOSED = 'FIN-WAIT-1 0 7336 151.248.113.177:3082 203.0.113.4:45555 uid:1000 ino:0 sk:9c08432e\n\trto:420 mss:1448 bytes_acked:665 retrans:1/4 unacked:5'


class SocketProofTests(unittest.TestCase):
    def test_own_pid_and_tcp_fields_are_attributed_without_addresses_or_payloads(self):
        rows, excluded = proof.Tracker(39002, 1000).observe(OWN, 0.5)
        self.assertEqual(excluded, 0)
        self.assertEqual(rows[0]['sendQ'], 7335)
        self.assertEqual(rows[0]['tcp']['mss'], '1448')
        self.assertEqual(rows[0]['tcp']['retrans'], '0/3')
        self.assertEqual(rows[0]['tcp'], {'mss': '1448', 'pmtu': '1500', 'bytes_acked': '665', 'retrans': '0/3', 'unacked': '5'})
        self.assertTrue(rows[0]['currentPidVerified'])
        self.assertFalse(rows[0]['previousOwnTuple'])
        report = json.dumps(rows)
        for secret in ('151.248.113.177', '203.0.113.4', '45555', '9c08432e'):
            self.assertNotIn(secret, report)

    def test_same_previously_owned_tuple_remains_honestly_attributed_after_close(self):
        tracker = proof.Tracker(39002, 1000)
        before, _ = tracker.observe(OWN, 0.5)
        after, excluded = tracker.observe(CLOSED, 1.5)
        self.assertEqual(excluded, 0)
        self.assertEqual(after[0]['tupleHash'], before[0]['tupleHash'])
        self.assertEqual(after[0]['observedOwnPidAt'], 0.5)
        self.assertEqual(after[0]['state'], 'FIN-WAIT-1')
        self.assertFalse(after[0]['currentPidVerified'])
        self.assertTrue(after[0]['previousOwnTuple'])
        second, _ = tracker.observe(CLOSED.replace('FIN-WAIT-1', 'FIN-WAIT-2'), 2.5)
        self.assertEqual(second[0]['observedOwnPidAt'], 0.5)

    def test_unknown_orphan_other_pid_uid_or_port_is_excluded(self):
        for raw in (CLOSED, OWN.replace('pid=39002', 'pid=7'), OWN.replace('uid:1000', 'uid:1001'), OWN.replace(':3082', ':3081')):
            rows, excluded = proof.Tracker(39002, 1000).observe(raw, 1)
            self.assertEqual(rows, [])
            self.assertEqual(excluded, 1)

    def test_same_tuple_hash_is_stable_in_one_run_but_unlinkable_across_runs(self):
        tracker = proof.Tracker(39002, 1000)
        before, _ = tracker.observe(OWN, 0.25)
        again, _ = tracker.observe(OWN, 1.0)
        other, _ = proof.Tracker(39002, 1000).observe(OWN, 0.25)
        self.assertEqual(before[0]['tupleHash'], again[0]['tupleHash'])
        self.assertNotEqual(before[0]['tupleHash'], other[0]['tupleHash'])
        self.assertEqual(len(before[0]['tupleHash']), 64)
        self.assertNotIn(tracker.salt.hex(), json.dumps(before))

    def test_known_tuple_cannot_hide_a_different_owner_or_a_non_fin_orphan(self):
        changed_rows = [OWN.replace('pid=39002', 'pid=7'), CLOSED.replace('uid:1000', 'uid:1001')]
        changed_rows += [CLOSED.replace('FIN-WAIT-1', state) for state in ('ESTAB', 'CLOSE-WAIT', 'LAST-ACK', 'TIME-WAIT', 'CLOSING')]
        for changed in changed_rows:
            with self.subTest(changed=changed):
                tracker = proof.Tracker(39002, 1000)
                tracker.observe(OWN, 0.25)
                rows, excluded = tracker.observe(changed, 1)
                self.assertEqual(rows, [])
                self.assertEqual(excluded, 1)
                # An invalidated ownership record cannot later revive itself.
                rows, excluded = tracker.observe(CLOSED, 2)
                self.assertEqual(rows, [])
                self.assertEqual(excluded, 1)

    def test_closed_descriptor_needs_a_matching_unambiguous_cookie(self):
        for before, after in ((OWN.replace('sk:9c08432e', ''), CLOSED),
                              (OWN, CLOSED.replace('sk:9c08432e', '')),
                              (OWN, CLOSED + ' sk:ffffffff')):
            tracker = proof.Tracker(39002, 1000)
            tracker.observe(before, 0.25)
            rows, excluded = tracker.observe(after, 1)
            self.assertEqual(rows, [])
            self.assertEqual(excluded, 1)

    def test_new_owned_socket_cookie_resets_the_first_ownership_time(self):
        tracker = proof.Tracker(39002, 1000)
        tracker.observe(OWN, 0.25)
        replacement, _ = tracker.observe(OWN.replace('sk:9c08432e', 'sk:ffffffff'), 2)
        self.assertEqual(replacement[0]['observedOwnPidAt'], 2)
        after, excluded = tracker.observe(CLOSED.replace('sk:9c08432e', 'sk:ffffffff'), 3)
        self.assertEqual(excluded, 0)
        self.assertEqual(after[0]['observedOwnPidAt'], 2)

    def test_quoted_process_names_cannot_supply_pid_or_metric_fields(self):
        spoofed = OWN.replace('"python",pid=39002', '"pid=39002 mss:9999 bytes_acked:9999",pid=7')
        self.assertEqual(proof.Tracker(39002, 1000).observe(spoofed, 1), ([], 1))
        with_name = OWN.replace('"python"', '"worker mss:9999 bytes_acked:9999"')
        rows, _ = proof.Tracker(39002, 1000).observe(with_name, 1)
        self.assertEqual(rows[0]['tcp']['mss'], '1448')
        self.assertEqual(rows[0]['tcp']['bytes_acked'], '665')
        shared = OWN.replace('fd=5))', 'fd=5),("other",pid=7,fd=8))')
        self.assertEqual(proof.Tracker(39002, 1000).observe(shared, 1), ([], 1))

    def test_multiline_ipv6_rows_do_not_merge_across_malformed_headers(self):
        ipv6 = OWN.replace('151.248.113.177:3082', '[2001:db8::1]:3082').replace('203.0.113.4:45555', '[2001:db8::2]:45555')
        rows, excluded = proof.Tracker(39002, 1000).observe(ipv6 + '\ninvalid row\n\tbytes_received:99999\n', 1)
        self.assertEqual(excluded, 0)
        self.assertEqual(rows[0]['tcp']['mss'], '1448')
        self.assertNotIn('2001:db8', json.dumps(rows))
        self.assertNotIn('bytes_received', rows[0]['tcp'])

    def test_tcp_metadata_requires_exact_numeric_whitelisted_fields(self):
        source = OWN.replace('mss:1448', 'advmss:1450 mss:1448junk').replace('bytes_acked:665', 'bytes_acked:665/private')
        source += ' bytes_sent:9999 pmtu_hint:9000 payload:PRIVATE'
        rows, _ = proof.Tracker(39002, 1000).observe(source, 1)
        self.assertEqual(rows[0]['tcp'], {'pmtu': '1500', 'retrans': '0/3', 'unacked': '5'})
        self.assertNotIn('PRIVATE', json.dumps(rows))

    def test_ss_request_is_port_scoped_and_never_exports_stderr(self):
        result = mock.Mock(returncode=0, stdout=OWN.encode(), stderr=b'Operation not permitted PRIVATE')
        with mock.patch.object(proof.subprocess, 'run', return_value=result) as run:
            raw, capabilities = proof.ss('all')
        self.assertEqual(raw, OWN)
        self.assertEqual(run.call_args.args[0], ['ss', '-tinepH', 'state', 'all', '( sport = :3082 )'])
        self.assertEqual(run.call_args.kwargs['timeout'], 2)
        self.assertEqual(capabilities, {'warningsPresent': True, 'netlinkDenied': True})
        self.assertNotIn('PRIVATE', json.dumps(capabilities))
        result.stdout = b'x' * (128 * 1024 + 1)
        with mock.patch.object(proof.subprocess, 'run', return_value=result):
            with self.assertRaisesRegex(RuntimeError, '^MOUSE_SEARCH_SOCKET_SS_FAILED_OR_LIMIT$'):
                proof.ss('all')

    def test_process_restart_or_main_pid_change_invalidates_ownership(self):
        for actual_pid, token in ((7, 'original'), (39002, 'reused')):
            with mock.patch.object(proof, 'service_pid', return_value=actual_pid), mock.patch.object(proof, 'process_identity', return_value=token):
                with self.assertRaisesRegex(RuntimeError, '^MOUSE_SEARCH_SOCKET_PID_CHANGED$'):
                    proof.verify_pid(39002, 'original')

    def test_inactive_invalid_or_unreadable_unit_cannot_authorize_any_pid(self):
        for status, stdout in ((0, 'ActiveState=inactive\nMainPID=39002\n'),
                               (0, 'ActiveState=active\nMainPID=0\n'),
                               (0, 'ActiveState=active\nMainPID=not-a-pid\n'),
                               (1, 'ActiveState=active\nMainPID=39002\n')):
            with mock.patch.object(proof.subprocess, 'run', return_value=mock.Mock(returncode=status, stdout=stdout)):
                with self.assertRaises(RuntimeError):
                    proof.service_pid()

    def test_listener_proof_uses_all_state_format_and_requires_owned_listener(self):
        listener = 'LISTEN 0 128 0.0.0.0:3082 0.0.0.0:* users:(("python",pid=39002,fd=3)) uid:1000 sk:123\n'
        with mock.patch.object(proof, 'ss', return_value=(listener + OWN, {})) as sampler:
            proof.verify_listener(39002)
        sampler.assert_called_once_with('all')
        for raw in (OWN, listener.replace('pid=39002', 'pid=7'), listener.replace(':3082', ':3081')):
            with mock.patch.object(proof, 'ss', return_value=(raw, {})):
                with self.assertRaisesRegex(RuntimeError, '^MOUSE_SEARCH_SOCKET_LISTENER_PID$'):
                    proof.verify_listener(39002)

    def test_tuple_direction_peer_port_and_socket_cookie_cannot_be_substituted(self):
        for changed in (CLOSED.replace(':45555', ':45556'), CLOSED.replace('sk:9c08432e', 'sk:ffffffff'), CLOSED.replace('151.248.113.177:3082 203.0.113.4:45555', '203.0.113.4:45555 151.248.113.177:3082')):
            tracker = proof.Tracker(39002, 1000)
            tracker.observe(OWN, 0.25)
            rows, excluded = tracker.observe(changed, 1)
            self.assertEqual(rows, [])
            self.assertEqual(excluded, 1)


if __name__ == '__main__':
    unittest.main()
