import { Module, Global } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Global()
@Module({
    providers: [
        {
            provide: 'CONFIG',
            useFactory: () => {
                const configPath = path.resolve(__dirname, '../config/aws-config.json');
                if (!fs.existsSync(configPath)) {
                    throw new Error(`Config file not found at path: ${configPath}`);
                }

                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                console.log('Loaded Config:', config);
                return { 'aws-config': config };
            },
        },
    ],
    exports: ['CONFIG'],
})
export class ConfigModule {}
