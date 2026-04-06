import db from '../database/connection.js';

export class CustomerService {
    static async getByPhone(phone: string) {
        return db('customers').where({ phone }).first();
    }

    static async sync(phone: string, name: string) {
        const customer = await this.getByPhone(phone);
        if (!customer) {
            await db('customers').insert({
                phone,
                name,
                last_interaction: db.fn.now()
            });
        } else {
            await db('customers').where({ phone }).update({
                last_interaction: db.fn.now()
            });
        }
        return customer;
    }

    static async updateAddress(phone: string, address: string) {
        return db('customers').where({ phone }).update({ address });
    }
}
