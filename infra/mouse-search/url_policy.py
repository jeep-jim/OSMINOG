"""Public URL shape boundary shared by the search and model proof scripts.

This validates supplied URLs, not DNS reachability. The desktop additionally
pins public DNS answers before it fetches metadata or displays native results.
"""
import ipaddress
import re
from urllib.parse import urlsplit


def usable_row(row,limit=8192):
    if not isinstance(row,dict): return False
    url,title=row.get('url'),row.get('title')
    if not isinstance(url,str) or len(url)>limit or re.search(r'[\x00-\x20\x7f\\]',url) or not re.match(r'^https?://[^/?#@\\]+(?:[/?#]|$)',url,re.I) or not isinstance(title,str) or not title.strip():
        return False
    try:
        parsed=urlsplit(url);host=(parsed.hostname or '').lower().rstrip('.')
        if parsed.scheme not in ('http','https') or not host or '%' in host or parsed.username is not None or parsed.password is not None or parsed.port==0: return False
        if re.search(r'(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|onion)$',host): return False
        try: address=ipaddress.ip_address(host)
        except ValueError:
            # Reject noncanonical numeric IPv4 aliases (127.1, octal, hex).
            if re.fullmatch(r'(?:0[xX][0-9A-Fa-f]+|[0-9]+)(?:\.(?:0[xX][0-9A-Fa-f]+|[0-9]+))*',host): return False
            return '.' in host
        if not address.is_global or host=='168.63.129.16': return False
        if address.version==6:
            return address in ipaddress.ip_network('2000::/3') and not any(address in ipaddress.ip_network(net) for net in ('2001::/23','2001:db8::/32','2002::/16','3fff::/20'))
        return address not in ipaddress.ip_network('192.0.0.0/24')
    except ValueError:
        return False
