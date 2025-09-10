import { spawn, exec } from 'child_process';

export const COLORS = {
  Reset: '\x1b[0m',
  Red: '\x1b[31m',
  Green: '\x1b[32m',
  Yellow: '\x1b[33m',
  Blue: '\x1b[34m',
  Magenta: '\x1b[35m',
  Cyan: '\x1b[36m',
  White: '\x1b[37m',
};

// Хелпер для выполнения команд в баше
export const executeSingleCommand = (command, args) => {
  return new Promise((resolve, reject) => {
    // Запускаем команду
    const childProcess = spawn(command, args);

    let stdoutData = '';
    let stderrData = '';

    // Собираем стандартный вывод
    childProcess.stdout.on('data', data => {
      stdoutData += data.toString();
    });

    // Собираем ошибки
    childProcess.stderr.on('data', data => {
      stderrData += data.toString();
    });

    // Ожидаем завершения процесса
    childProcess.on('close', code => {
      if (code !== 0) {
        reject(new Error(`executeSingleCommand end with error ${code}: ${stderrData}`));
      } else {
        resolve(stdoutData.trim());
      }
    });
  });
};

// Генерируем публичный ключ из приватного
export const genPubKey = async privateKey => {
  const pubKey = await executeSingleCommand('bash', ['-c', `echo ${privateKey} | wg pubkey`]);
  return pubKey;
};

// Генерируем новую тройку ключей для клиента или сервера
export const genNewClientKeys = async () => {
  const randomKey = await executeSingleCommand('wg', ['genkey']); // Приватный ключ
  const presharedKey = await executeSingleCommand('wg', ['genkey']); // Общий дополнительный ключ
  const pubKey = await genPubKey(randomKey); // Публичный ключ

  return { randomKey, presharedKey, pubKey };
};

export const getServerIP = async () => {
  const externalInterface = await executeSingleCommand('bash', ['-c', `ip route | awk '/default/ {print $5; exit}'`]);
  const command = `ip addr show ${externalInterface} | grep "inet" | grep -v "inet6" | head -n 1 | awk '/inet/ {print $2}' | awk -F/ '{print $1}'`;
  const pubIP = await executeSingleCommand('bash', ['-c', command]);
  return pubIP;
};

export const restartProcess = () => {
  // Проверяем, запущены ли мы под PM2 (переменная устанавливается в конфигурационном файле)
  if (process.env.IS_PM2_PROC) {
     // Используем команду PM2 для перезапуска
     console.log('WG-control is running under PM2, restarting via the PM2 command');
     exec('pm2 restart all', (error) => {
         if (error) {
             console.error('Ошибка перезагрузки через PM2:', error);
             process.exit(1);
         }
     });
  } else {
     // Стандартный перезапуск если запущены не под PM2
     console.log('WG-control is launched as a separate process, we restart it via spawn')
     const args = process.argv;
     const command = args[0];
     const script = args[1];

     const child = spawn(command, [script, ...args.slice(2)], {
         env: { ...process.env, IS_RESTART: 'true' },
         stdio: 'inherit',
         detached: true
     });

     child.unref();
     process.exit(0);
  }
};
