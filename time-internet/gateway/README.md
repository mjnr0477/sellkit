# Linux gateway adapter (prototype)

This adapter adds a time-to-live to an IPv4 client entry in an nftables set. The kernel expires that entry automatically. A matching firewall policy can then stop that client's forwarded traffic at expiry. The expiry must come from the server, not the phone's clock.

## Requirements before use

- A Linux gateway you control and permission to administer it.
- An authorized upstream whose contract permits this service and any shared access/resale.
- WireGuard or another secure tunnel already configured and routed through the gateway.
- IP forwarding and NAT configured for the authorized uplink.
- A firewall policy that permits tunnel-to-internet forwarding only when the client IP is in the timed set and drops other tunnel-to-uplink traffic.
- Client traffic must have no alternate path that bypasses the gateway.

## Example nftables policy

Review this with your existing firewall before applying. Do not paste blindly onto a production server. This example adds a narrow policy for wg0; existing firewall rules, NAT, DNS, IPv6, and other interfaces still need review.

    table inet timed_access {
      set active_clients {
        type ipv4_addr
        flags timeout
      }
      chain forward {
        type filter hook forward priority 0; policy accept;
        iifname "wg0" oifname != "wg0" ip saddr @active_clients accept
        iifname "wg0" oifname != "wg0" drop
      }
    }

The adapter adds a client with a timeout and deletes the element to revoke access. It uses execFile argument arrays rather than interpolating client data into a shell. A duplicate add may return an nftables error; renewal should be an explicit, audited revoke-and-grant operation.

## What this does not prove

This component enforces a timer at the firewall boundary; it does not create upstream bandwidth, remove a provider's volume cap, guarantee a fair-use policy, or establish that a low price is sustainable. Do not attach it to a B-Live consumer bundle as a tethering workaround: public guidance says B-Live is intended for personal use and hotspot/tethering is not allowed. Use an authorized shared-access or wholesale supply.

## Tests

Run npm test from the time-internet directory with Node.js 20 or newer. Tests mock the nft executable and prove argument validation and expiry calculation only. They do not replace a live gateway traffic test.
