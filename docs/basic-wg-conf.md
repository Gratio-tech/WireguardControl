### Сначала генерируем ключи
Приватный ключ генерируем командой `genkey`.
Также при желании дополнительного шифрования, этой же утилитой можно генерировать и PresharedKey:
```bash
wg genkey
# Генерируем из приватного ключа публичный
echo "kOd3FVBggwpjD3AlZKXUxNTzJT0+f3MJdUdR8n6ZBn8=" | wg pubkey
```

## Пример базовой конфигурации Wireguard
Рекомендуем вам выбирать случайные порты для вашей конфигурации.

```
[Interface]
Address = 10.1.0.1/24
PrivateKey = [SERVER_PRIVATE_KEY]
ListenPort = 55850

# Интерфейс eth0 рекомендуется заменить на ваш выходной интерфейс
PostUp = iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostUp = ip rule add from $(ip -4 addr show dev eth0 | awk '/inet / {print $2}' | cut -d/ -f1) table main

PostDown = iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
PostDown = ip rule del from $(ip -4 addr show dev eth0 | awk '/inet / {print $2}' | cut -d/ -f1) table main
```

## Пример базового набора правил iptables
```
Chain INPUT (policy ACCEPT)
target     prot opt in     out     source               destination
ACCEPT     0    --  lo     *       0.0.0.0/0            0.0.0.0/0
ACCEPT     6    --  *      *       0.0.0.0/0            0.0.0.0/0            tcp dpt:53
ACCEPT     17   --  *      *       0.0.0.0/0            0.0.0.0/0            udp dpt:53
ACCEPT     17   --  *      *       0.0.0.0/0            0.0.0.0/0            udp dpt:55850
ACCEPT     6    --  *      *       0.0.0.0/0            0.0.0.0/0            tcp dpt:222
ACCEPT     6    --  wg     *       0.0.0.0/0            0.0.0.0/0            tcp dpt:9977
ACCEPT     6    --  wg     *       0.0.0.0/0            0.0.0.0/0            tcp dpt:5000
ACCEPT     6    --  wg     *       0.0.0.0/0            0.0.0.0/0            tcp dpt:53
ACCEPT     17   --  wg     *       0.0.0.0/0            0.0.0.0/0            udp dpt:53
ACCEPT     0    --  *      *       0.0.0.0/0            0.0.0.0/0            state RELATED,ESTABLISHED
ACCEPT     0    --  *      *       0.0.0.0/0            0.0.0.0/0            ctstate RELATED,ESTABLISHED
ACCEPT     1    --  *      *       0.0.0.0/0            0.0.0.0/0            icmptype 3
ACCEPT     1    --  *      *       0.0.0.0/0            0.0.0.0/0            icmptype 11
ACCEPT     1    --  *      *       0.0.0.0/0            0.0.0.0/0            icmptype 12
ACCEPT     1    --  wg     *       0.0.0.0/0            0.0.0.0/0            icmptype 8
DROP       1    --  *      *       0.0.0.0/0            0.0.0.0/0            icmptype 8
DROP       0    --  *      *       0.0.0.0/0            0.0.0.0/0

Chain FORWARD (policy ACCEPT)
target     prot opt in     out     source               destination
ACCEPT     0    --  wg     eth0    0.0.0.0/0            0.0.0.0/0
ACCEPT     0    --  eth0   wg      0.0.0.0/0            0.0.0.0/0            ctstate RELATED,ESTABLISHED

Chain OUTPUT (policy ACCEPT)
target     prot opt in     out     source               destination
ACCEPT     17   --  *      *       0.0.0.0/0            0.0.0.0/0            udp dpt:123
ACCEPT     17   --  *      *       0.0.0.0/0            0.0.0.0/0            udp dpt:55850
ACCEPT     0    --  *      *       0.0.0.0/0            0.0.0.0/0            state RELATED,ESTABLISHED
DROP       6    --  *      *       0.0.0.0/0            0.0.0.0/0            multiport dports 25,587,465,2525
```

## Включить форвардинг трафика
Сервер, получив пакет, который не предназначается ни одному из его IP-адресов, не отбросит его, а попытается перенаправить в соответствии со своими маршрутами. Выполняем на обоих нодах:
```bash
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
echo "net.ipv4.conf.all.forwarding=1" >> /etc/sysctl.conf
```
Проверяем: `sysctl -p /etc/sysctl.conf`
