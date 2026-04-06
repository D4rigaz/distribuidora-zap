import db from '../database/connection.js';

export class ProductService {
    static async getAvailableProducts() {
        return db('products')
            .where('stock', '>', 0)
            .orderBy('category', 'asc');
    }

    static async getById(id: number) {
        return db('products').where({ id }).first();
    }
}
