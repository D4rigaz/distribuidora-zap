import db from '../database/connection.js';

export interface CartItem {
    id: number;
    name: string;
    price: number;
    quantity: number;
}

export interface Session {
    phone: string;
    step: 'idle' | 'awaiting_quantity' | 'awaiting_address' | 'awaiting_confirmation';
    lastProductId?: number;
    cart: CartItem[];
}

export class SessionService {
    static async getOrCreate(phone: string): Promise<Session> {
        let session = await db('sessions').where('phone', phone).first();

        if (!session) {
            const newSession = {
                phone,
                step: 'idle',
                cart: JSON.stringify([])
            };
            await db('sessions').insert(newSession);
            return {
                phone,
                step: 'idle',
                cart: []
            };
        }

        return {
            phone: session.phone,
            step: session.step,
            lastProductId: session.last_product_id,
            cart: typeof session.cart === 'string' ? JSON.parse(session.cart) : session.cart
        };
    }

    static async save(session: Session) {
        return db('sessions').where('phone', session.phone).update({
            step: session.step,
            last_product_id: session.lastProductId || null,
            cart: JSON.stringify(session.cart),
            updated_at: db.fn.now()
        });
    }

    static async clear(phone: string) {
        return db('sessions').where('phone', phone).update({
            step: 'idle',
            last_product_id: null,
            cart: JSON.stringify([]),
            updated_at: db.fn.now()
        });
    }
}
