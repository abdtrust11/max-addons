/*
    This module create by: thanhchatvn@gmail.com
    License: OPL-1
    Please do not modification if i not accept
    Thanks for understand
 */
odoo.define('pos_retail.database', function (require) {
    var db = require('point_of_sale.DB');
    var _super_db = db.prototype;

    // We replace method of core odoo because
    // 1. odoo core looping products for store to database parameter
    //    - And if big products (few millions products) will made browse crash
    //    - And we need cache faster than, store values for quickly search
    _super_db.add_products = function (products) {
        var stored_categories = this.product_by_category_id;
        if (!products instanceof Array) {
            products = [products];
        }
        if (!self.posmodel) {
            self.posmodel = self.pos;
        }
        if (self.posmodel.config.bus_id) {
            var products_filter_by_bus_id = []
            var bus_id = self.posmodel.config.bus_id[0];
            self.posmodel.bus_id = bus_id;
            for (var i = 0; i < products.length; i++) {
                var product = products[i];
                if (product.bus_ids && product.bus_ids.length != 0 && product.bus_ids.indexOf(bus_id) != -1) {
                    products_filter_by_bus_id.push(product);
                }
                if (product.bus_ids && product.bus_ids.length == 0) {
                    products_filter_by_bus_id.push(product);
                }
                if (product.bus_ids == undefined) {
                    products_filter_by_bus_id.push(product);
                }
            }
            products = products_filter_by_bus_id;
        }
        for (var i = 0, len = products.length; i < len; i++) {
            var product = products[i];
            // customize
            if (self.posmodel.server_version == 10) { // v10 only
                var pricelist = self.posmodel.pricelist;
                if (pricelist) {
                    product['price'] = self.posmodel.get_price(product, pricelist, 1);
                } else {
                    product['price'] = product['list_price'];
                }
            }
            if (this.stock_datas[product['id']]) { // add qty on hand to product
                product['qty_available'] = this.stock_datas[product['id']]
            } else {
                product['qty_available'] = null;
            }
            if (product['uom_id']) { // save core uom id of product
                product['base_uom_id'] = product['uom_id'];
            }
            this.product_id_by_name[product['display_name']] = product['id'];
            this.product_string_by_id[product['id']] = this.get_product_string(product);
            // start core odoo
            var search_string = this._product_search_string(product);
            var categ_id = product.pos_categ_id ? product.pos_categ_id[0] : this.root_category_id;
            if (product.product_tmpl_id instanceof Array) { // it very very important, please keep on v11 and 12. because some functions used product_tmpl_id with integer not array
                product.product_tmpl_id = product.product_tmpl_id[0];
            } else {
                product.product_tmpl_id = product.product_tmpl_id;
            }

            if (!stored_categories[categ_id]) {
                stored_categories[categ_id] = [];
            }
            stored_categories[categ_id].push(product.id);

            if (this.category_search_string[categ_id] === undefined) {
                this.category_search_string[categ_id] = '';
            }
            this.category_search_string[categ_id] += search_string;

            var ancestors = this.get_category_ancestors_ids(categ_id) || [];

            for (var j = 0, jlen = ancestors.length; j < jlen; j++) {
                var ancestor = ancestors[j];
                if (!stored_categories[ancestor]) {
                    stored_categories[ancestor] = [];
                }
                stored_categories[ancestor].push(product.id);

                if (this.category_search_string[ancestor] === undefined) {
                    this.category_search_string[ancestor] = '';
                }
                this.category_search_string[ancestor] += search_string;
            }
            this.product_by_id[product.id] = product;
            if (product.barcode) {
                this.product_by_barcode[product.barcode] = product;
            }
            // end core odoo
            // Add product by suppliers barcode
            if (product['supplier_barcode']) {
                if (!this.product_by_supplier_barcode[product['supplier_barcode']]) {
                    this.product_by_supplier_barcode[product['supplier_barcode']] = [product];
                } else {
                    this.product_by_supplier_barcode[product['supplier_barcode']].push(product);
                }
            }
            // multi category
            if (product.pos_categ_ids.length) {
                for (var j = 0; j < product.pos_categ_ids.length; j++) {
                    var categ_id = product.pos_categ_ids[j];
                    if (!stored_categories[categ_id]) {
                        stored_categories[categ_id] = [];
                    }
                    stored_categories[categ_id].push(product.id);
                    if (this.category_search_string[categ_id] === undefined) {
                        this.category_search_string[categ_id] = '';
                    }
                    this.category_search_string[categ_id] += search_string;
                    var ancestors = this.get_category_ancestors_ids(categ_id) || [];
                    for (var z = 0, jlen = ancestors.length; z < jlen; z++) {
                        var ancestor = ancestors[z];
                        if (!stored_categories[ancestor]) {
                            stored_categories[ancestor] = [];
                        }
                        stored_categories[ancestor].push(product.id);
                        if (this.category_search_string[ancestor] === undefined) {
                            this.category_search_string[ancestor] = '';
                        }
                        this.category_search_string[ancestor] += search_string;
                    }
                }
            }
        }
    };
    _super_db.search_partner = function (query) {
        try {
            query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
            query = query.replace(/ /g, '.+');
            var re = RegExp("([0-9]+):.*?" + query, "gi");
        } catch (e) {
            return [];
        }
        var results = [];
        for (var i = 0; i < this.limit; i++) {
            var r = re.exec(this.partner_search_string);
            if (r) {
                var id = Number(r[1]);
                var partner = this.get_partner_by_id(id);
                if (partner) { // if partner exist, we add to list. Core odoo not check it
                    results.push(this.get_partner_by_id(id));
                }
            } else {
                break;
            }
        }
        return results;
    };
    _super_db.add_partners = function (partners) {
        // customize
        // ---------------------------------
        if (!self.posmodel) {
            self.posmodel = self.pos;
        }
        // ---------------------------------
        // core
        var updated_count = 0;
        var new_write_date = '';
        var partner;
        for (var i = 0, len = partners.length; i < len; i++) {
            partner = partners[i];
            if (partner.deleted) {
                delete this.partner_string_by_id[partner['id']];
                delete this.partner_by_id[partner['id']];
                continue;
            }
            this.partner_string_by_id[partner.id] = this.get_partner_string(partner);
            if (partner.property_product_pricelist && self.posmodel.pricelist_by_id) { // re-update pricelist when pricelist change the same
                var pricelist = self.posmodel.pricelist_by_id[partner.property_product_pricelist[0]];
                if (pricelist) {
                    partner.property_product_pricelist = [pricelist.id, pricelist.display_name]
                }
            }
            if (partner.pos_loyalty_type) {
                partner.pos_loyalty_type_name = partner.pos_loyalty_type[1];
            }
            // core odoo original
            var local_partner_date = (this.partner_write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
            var dist_partner_date = (partner.write_date || '').replace(/^(\d{4}-\d{2}-\d{2}) ((\d{2}:?){3})$/, '$1T$2Z');
            if (this.partner_write_date &&
                this.partner_by_id[partner.id] &&
                new Date(local_partner_date).getTime() + 1000 >=
                new Date(dist_partner_date).getTime()) {
                // FIXME: The write_date is stored with milisec precision in the database
                // but the dates we get back are only precise to the second. This means when
                // you read partners modified strictly after time X, you get back partners that were
                // modified X - 1 sec ago.
                continue;
            } else if (new_write_date < partner.write_date) {
                new_write_date = partner.write_date;
            }
            if (!this.partner_by_id[partner.id]) {
                this.partner_sorted.push(partner.id);
            }
            this.partner_by_id[partner.id] = partner;

            updated_count += 1;
        }

        this.partner_write_date = new_write_date || this.partner_write_date;

        if (updated_count) {
            // If there were updates, we need to completely
            // rebuild the search string and the barcode indexing

            this.partner_search_string = "";
            this.partner_by_barcode = {};

            for (var id in this.partner_by_id) {
                partner = this.partner_by_id[id];

                if (partner.barcode) {
                    this.partner_by_barcode[partner.barcode] = partner;
                }
                partner.address = (partner.street || '') + ', ' +
                    (partner.zip || '') + ' ' +
                    (partner.city || '') + ', ' +
                    (partner.country_id[1] || '');
                this.partner_search_string += this._partner_search_string(partner);
            }
        }
        return updated_count;
    };

    db.include({
        init: function (options) {
            this._super(options);
            this.product_by_supplier_barcode = {};
            this.sequence = 1;
            // pos orders
            this.order_by_id = {};
            this.order_by_ean13 = {};
            this.order_search_string = "";
            this.order_search_string_by_id = {};
            this.order_line_by_id = {};
            // account invoices
            this.invoice_by_id = {};
            this.invoice_by_partner_id = {};
            this.invoice_search_string = "";
            this.invoice_search_string_by_id = {};
            this.invoice_line_by_id = {};
            // auto complete search
            this.pos_order_string_by_id = {};
            this.invoice_string_by_id = {};
            this.sale_order_string_by_id = {};
            this.partner_string_by_id = {};
            this.product_string_by_id = {};
            // sale orders
            this.sale_order_by_id = {};
            this.sale_order_by_name = {};
            this.sale_search_string = '';
            this.sale_search_string_by_id = {};
            this.sale_line_by_id = {};
            // medical
            this.insurances = [];
            this.insurances_autocomplete = [];
            this.insurance_by_id = {};
            this.insurance_by_partner_id = {};
            // stock datas
            this.stock_datas = {};
            // products
            this.product_id_by_name = {};
        },
        get_product_by_id: function (id) {
            var product = this.product_by_id[id];
            if (!product) {
                return self.posmodel.gui.show_popup('error', {
                    title: 'Warning',
                    body: 'Product not available on pos, please reinstall pos database'
                })
            } else {
                return this._super(id)
            }
        },
        get_partners_sorted: function (max_count) {
            var partners = [];
            var max = 0;
            for (var partner_id in this.partner_by_id) {
                partners.push(this.partner_by_id[partner_id]);
                max += 1;
                if (max_count > 0 && max >= max_count) {
                    break;
                }
            }
            return partners;
        },
        get_products: function (max_count) {
            var products = [];
            var max = 0;
            for (var product_id in this.product_by_id) {
                products.push(this.product_by_id[product_id]);
                max += 1;
                if (max_count > 0 && max >= max_count) {
                    break;
                }
            }
            return products;
        },
        get_partner_string: function (partner) {
            var label = partner['name'];
            if (partner['email']) {
                label += ' | ' + partner['email']
            }
            if (partner['phone']) {
                label += ' | ' + partner['phone']
            }
            if (partner['mobile']) {
                label += ' | ' + partner['mobile']
            }
            return label
        },
        get_partners_source: function () {
            var source = [];
            for (var partner_id in this.partner_string_by_id) {
                var label = this.partner_string_by_id[partner_id];
                source.push({
                    value: partner_id,
                    label: label
                });
            }
            return source;
        },
        get_product_string: function (product) {
            var label = product['default_code'] || '';
            if (product['barcode']) {
                label += ' | ' + product['barcode'];
            }
            if (product['name']) {
                label += ' | ' + product['name'];
            }
            return label
        },
        get_products_source: function () {
            var source = [];
            for (var product_id in this.product_string_by_id) {
                var label = this.product_string_by_id[product_id];
                source.push({
                    value: product_id,
                    label: label
                })
            }
            return source;
        },
        get_product_by_category: function (category_id) {
            var list = this._super(category_id);
            if (!self.posmodel) {
                self.posmodel = self.pos;
            }
            if (self.posmodel.config.active_product_sort_by) {
                if (self.posmodel.config.default_product_sort_by == 'a_z') {
                    list = list.sort(self.posmodel.sort_by('display_name', false, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                } else if (self.posmodel.config.default_product_sort_by == 'z_a') {
                    list = list.sort(self.posmodel.sort_by('display_name', true, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                } else if (self.posmodel.config.default_product_sort_by == 'low_price') {
                    list = list.sort(self.posmodel.sort_by('list_price', false, parseInt));
                } else if (self.posmodel.config.default_product_sort_by == 'high_price') {
                    list = list.sort(self.posmodel.sort_by('list_price', true, parseInt));
                } else if (self.posmodel.config.default_product_sort_by == 'pos_sequence') {
                    list = list.sort(self.posmodel.sort_by('pos_sequence', false, function (a) {
                        if (!a) {
                            a = 'N/A';
                        }
                        return a.toUpperCase()
                    }));
                }
            }
            return list
        },
        // save pos orders
        _order_search_string: function (order) {
            var str = order.ean13;
            str += '|' + order.name;
            if (order.create_date) {
                str += '|' + order['create_date'];
            }
            if (order.partner_id) {
                var partner = this.partner_by_id[order.partner_id[0]]
                if (partner) {
                    if (partner['name']) {
                        str += '|' + partner['name'];
                    }
                    if (partner.mobile) {
                        str += '|' + partner['mobile'];
                    }
                    if (partner.phone) {
                        str += '|' + partner['phone'];
                    }
                    if (partner.email) {
                        str += '|' + partner['email'];
                    }
                }
            }
            if (order.date_order) {
                str += '|' + order['date_order'];
            }
            str = '' + order['id'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_order: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.order_search_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.order_by_id[id] !== undefined) {
                        results.push(this.order_by_id[id]);
                    }
                } else {
                    break;
                }
            }
            return results;
        },
        get_pos_orders: function (max_count) {
            var orders = [];
            var max = 0;
            for (var order_id in this.order_by_id) {
                orders.push(this.order_by_id[order_id]);
                max += 1;
                if (max_count > 0 && max >= max_count) {
                    break;
                }
            }
            return orders;
        },
        get_pos_orders_source: function () {
            var source = [];
            for (var pos_order_id in this.pos_order_string_by_id) {
                var label = this.pos_order_string_by_id[pos_order_id];
                source.push({
                    value: pos_order_id,
                    label: label
                })
            }
            return source;
        },
        get_pos_order_string: function (order) {
            var label = order['name']; // auto complete
            if (order['ean13']) {
                label += ', ' + order['ean13']
            }
            if (order['pos_reference']) {
                label += ', ' + order['pos_reference']
            }
            if (order.partner_id) {
                var partner = this.get_partner_by_id(order.partner_id[0]);
                if (partner) {
                    label += ', ' + partner['name'];
                    if (partner['email']) {
                        label += ', ' + partner['email']
                    }
                    if (partner['phone']) {
                        label += ', ' + partner['phone']
                    }
                    if (partner['mobile']) {
                        label += ', ' + partner['mobile']
                    }
                }
            }
            return label
        },
        save_pos_orders: function (orders) { // stores pos orders
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                if (order.deleted) {
                    delete this.order_by_id[order['id']];
                    delete this.order_by_ean13[order.ean13];
                    delete this.pos_order_string_by_id[order['id']];
                    continue
                }
                var old_order = this.order_by_id[order['id']];
                if (old_order && old_order['lines']) {
                    order['lines'] = old_order['lines'];
                } else {
                    order['lines'] = [];
                }
                if (order.partner_id) {
                    var partner;
                    if (order.partner_id && order.partner_id[0]) {
                        partner = this.get_partner_by_id(order.partner_id[0]);
                    } else {
                        partner = this.get_partner_by_id(order.partner_id);
                    }
                    if (partner) {
                        order.partner = partner;
                        order.partner_name = partner.name;
                    }
                }
                this.order_by_id[order['id']] = order;
                this.order_by_ean13[order.ean13] = order;
                this.order_search_string_by_id[order.id] = this._order_search_string(order);
                this.pos_order_string_by_id[order['id']] = this.get_pos_order_string(order);
            }
            this.order_search_string = "";
            for (var order_id in this.order_search_string_by_id) {
                this.order_search_string += this.order_search_string_by_id[order_id];
            }
        },
        save_data_sync_order_line: function (values) {
            for (var i = 0; i < values.length; i++) {
                var new_order_line = values[i];
                if (new_order_line.deleted) { // deleted record
                    var old_line = this.order_line_by_id[new_order_line['id']];
                    delete this.order_line_by_id[old_line['id']];
                    if (old_line) {
                        var order = this.order_by_id[old_line['order_id'][0]];
                        var lines = _.filter(order.lines, function (line) {
                            return line['id'] != old_line['id']
                        });
                        order.lines = lines;
                    } else {
                        console.error('old line null');
                        debugger
                    }
                } else {                     // deleted record
                    var old_line = this.order_line_by_id[new_order_line['id']];
                    this.order_line_by_id[new_order_line['id']] = new_order_line;
                    if (old_line) {          // old line save before
                        var order = this.order_by_id[old_line['order_id'][0]];
                        var lines = _.filter(order.lines, function (line) {
                            return line['id'] != old_line['id']
                        });
                        lines.push(new_order_line)
                        order.lines = lines;
                    } else {                 // push new items
                        var order = this.order_by_id[new_order_line['order_id'][0]];
                        if (order) {
                            order.lines.push(new_order_line)
                        }
                    }
                }
            }
        },
        save_pos_order_line: function (lines) { // save order line from backend
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (!line.deleted) {
                    this.order_line_by_id[line['id']] = line;
                    var order = this.order_by_id[line['order_id'][0]];
                    if (order) {
                        order['lines'].push(line)
                    }
                }
            }
        },
        // save invoices
        _invoice_search_string: function (invoice) {
            var str = invoice.number;
            str += '|' + invoice.name;
            if (invoice.origin) {
                str += '|' + invoice.origin;
            }
            if (invoice.create_date) {
                str += '|' + invoice.create_date;
            }
            if (invoice.partner_id) {
                var partner = this.partner_by_id[invoice.partner_id[0]]
                if (partner) {
                    if (partner['name']) {
                        str += '|' + partner['name'];
                    }
                    if (partner.mobile) {
                        str += '|' + partner['mobile'];
                    }
                    if (partner.phone) {
                        str += '|' + partner['phone'];
                    }
                    if (partner.email) {
                        str += '|' + partner['email'];
                    }
                }
            }
            if (invoice.date_invoice) {
                str += '|' + invoice['date_invoice'];
            }
            str = '' + invoice['id'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_invoice: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.invoice_search_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.invoice_by_id[id] !== undefined) {
                        results.push(this.invoice_by_id[id]);
                    }
                } else {
                    break;
                }
            }
            return results;
        },
        get_invoices: function (max_count) {
            var invoices = [];
            var max = 0;
            for (var invoice_id in this.invoice_by_id) {
                invoices.push(this.invoice_by_id[invoice_id]);
                max += 1;
                if (max_count > 0 && max >= max_count) {
                    break;
                }

            }
            return invoices;
        },
        get_invoices_source: function () {
            var source = [];
            for (var invoice_id in this.invoice_string_by_id) {
                var label = this.invoice_string_by_id[invoice_id];
                source.push({
                    value: invoice_id,
                    label: label
                })
            }
            return source;
        },
        get_invoice_string: function (invoice) {
            var label = invoice['number'];
            var partner = this.get_partner_by_id(invoice.partner_id[0]);
            if (!partner) {
                return label;
            }
            if (invoice['origin']) {
                label += ', ' + invoice['origin'];
            }
            if (invoice['name']) {
                label += ', ' + invoice['name'];
            }
            if (partner['display_name']) {
                label += ', ' + partner['display_name']
            }
            if (partner['email']) {
                label += ', ' + partner['email']
            }
            if (partner['phone']) {
                label += ', ' + partner['phone']
            }
            if (partner['mobile']) {
                label += ', ' + partner['mobile']
            }
            return label
        },
        save_invoices: function (invoices) {
            for (var i = 0; i < invoices.length; i++) {
                var invoice = invoices[i];
                if (invoice.deleted) {
                    delete this.invoice_by_id[invoice['id']];
                    delete this.invoice_string_by_id[invoice['id']];
                    continue
                }
                var old_invoice = this.invoice_by_id[invoice['id']];
                if (old_invoice && old_invoice['lines']) {
                    invoice['lines'] = old_invoice['lines'];
                } else {
                    invoice['lines'] = [];
                }
                this.invoice_by_id[invoice.id] = invoice;
                if (!this.invoice_by_partner_id[invoice.partner_id[0]]) {
                    this.invoice_by_partner_id[invoice.partner_id[0]] = [invoice]
                } else {
                    this.invoice_by_partner_id[invoice.partner_id[0]].push(invoice);
                }
                invoice['partner_name'] = invoice.partner_id[1];
                if (invoice.payment_term_id) {
                    invoice['payment_term'] = invoice.payment_term_id[1];
                } else {
                    invoice['payment_term'] = 'N/A';
                }
                if (invoice.user_id) {
                    invoice['user'] = invoice.user_id[1];
                } else {
                    invoice['user'] = 'N/A';
                }
                this.invoice_string_by_id[invoice['id']] = this.get_invoice_string(invoice);
                this.invoice_search_string_by_id[invoice['id']] = this._invoice_search_string(invoice);
            }
            this.invoice_search_string = "";
            for (var invoice_id in this.invoice_search_string_by_id) {
                this.invoice_search_string += this.invoice_search_string_by_id[invoice_id];
            }
        },
        // save invoice lines
        save_invoice_lines: function (lines) {
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (!line.deleted) {
                    this.invoice_line_by_id[line['id']] = line;
                    var invoice = this.invoice_by_id[line['invoice_id'][0]];
                    if (invoice) {
                        invoice['lines'].push(line)
                    }
                }
            }
        },
        save_data_sync_invoice_line: function (values) {
            for (var i = 0; i < values.length; i++) {
                var new_line = values[i];
                if (new_line.deleted) {     // deleted record
                    var old_line = this.invoice_line_by_id[new_line['id']];
                    if (old_line) {
                        this.invoice_line_by_id[old_line['id']] = null;
                        var invoice = this.invoice_by_id[old_line['invoice_id'][0]];
                        var lines = _.filter(invoice.lines, function (line) {
                            return line['id'] != old_line['id']
                        });
                        invoice.lines = lines;
                    }
                } else {                     // deleted record
                    var old_line = this.invoice_line_by_id[new_line['id']];
                    this.invoice_line_by_id[new_line['id']] = new_line;
                    if (old_line) {          // old line save before
                        var invoice = this.invoice_by_id[old_line['invoice_id'][0]];
                        var lines = _.filter(invoice.lines, function (line) {
                            return line['id'] != old_line['id']
                        });
                        lines.push(new_line)
                        invoice.lines = lines;
                    } else {                 // push new items
                        var invoice = this.invoice_by_id[new_line['invoice_id'][0]];
                        if (invoice) {
                            invoice.lines.push(new_line)
                        }
                    }
                }
            }
        },
        get_invoice_by_id: function (id) {
            return this.invoice_by_id[id];
        },
        _sale_order_search_string: function (sale) {
            var str = sale.name;
            str += '|' + sale.origin;
            if (sale.client_order_ref) {
                str += '|' + sale.client_order_ref;
            }
            if (sale.create_date) {
                str += '|' + sale.create_date;
            }
            if (sale.partner_id) {
                var partner = this.partner_by_id[sale.partner_id[0]]
                if (partner) {
                    if (partner['name']) {
                        str += '|' + partner['name'];
                    }
                    if (partner.mobile) {
                        str += '|' + partner['mobile'];
                    }
                    if (partner.phone) {
                        str += '|' + partner['phone'];
                    }
                    if (partner.email) {
                        str += '|' + partner['email'];
                    }
                }
            }
            if (sale.origin) {
                str += '|' + sale.origin;
            }
            str = '' + sale['id'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_sale_orders: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var sale_orders = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.sale_search_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.sale_order_by_id[id] !== undefined) {
                        sale_orders.push(this.sale_order_by_id[id]);
                    }
                } else {
                    break;
                }
            }
            return sale_orders;
        },
        get_sale_orders: function (max_count) {
            var orders = [];
            var max = 0;
            for (var sale_id in this.sale_order_by_id) {
                orders.push(this.sale_order_by_id[sale_id]);
                max += 1;
                if (max_count > 0 && max >= max_count) {
                    break;
                }

            }
            return orders;
        },
        get_sale_orders_source: function () {
            var source = [];
            for (var sale_id in this.sale_order_string_by_id) {
                var label = this.sale_order_string_by_id[sale_id];
                source.push({
                    value: sale_id,
                    label: label
                })
            }
            return source;
        },
        save_sale_orders: function (sale_orders) {
            for (var i = 0; i < sale_orders.length; i++) {
                var sale = sale_orders[i];
                if (sale.deleted) {
                    delete this.sale_order_by_id[sale['id']];
                    delete this.sale_order_string_by_id[sale['id']];
                    delete this.sale_order_by_id[sale['id']];
                    delete this.sale_order_by_name[sale['name']];
                    continue
                }
                var old_sale = this.sale_order_by_id[sale['id']];
                if (old_sale && old_sale['lines']) {
                    sale['lines'] = old_sale['lines'];
                } else {
                    sale['lines'] = [];
                }
                var label = sale['name']; // auto complete
                if (sale['origin']) {
                    label += ',' + sale['origin'];
                }
                if (sale.partner_id) {
                    var partner = this.get_partner_by_id(sale.partner_id[0]);
                    sale.partner = partner;
                    if (partner) {
                        label += ', ' + partner['name'];
                        if (partner['email']) {
                            label += ', ' + partner['email']
                        }
                        if (partner['phone']) {
                            label += ', ' + partner['phone']
                        }
                        if (partner['mobile']) {
                            label += ', ' + partner['mobile']
                        }
                    }
                    sale['partner_name'] = sale.partner_id[1];
                }
                this.sale_order_string_by_id[sale['id']] = label;
                this.sale_order_by_id[sale['id']] = sale;
                this.sale_order_by_name[sale['name']] = sale;
                this.sale_search_string_by_id[sale['id']] = this._sale_order_search_string(sale);
            }
            this.sale_search_string = "";
            for (var sale_id in this.sale_search_string_by_id) {
                this.sale_search_string += this.sale_search_string_by_id[sale_id];
            }
        },
        save_sale_order_lines: function (lines) {
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (!line.deleted) {
                    this.sale_line_by_id[line['id']] = line;
                    var sale = this.sale_order_by_id[line['order_id'][0]];
                    if (sale) {
                        sale['lines'].push(line)
                    }
                }

            }
        },
        sync_sale_order_lines: function (values) {
            for (var i = 0; i < values.length; i++) {
                var new_line = values[i];
                if (new_line.deleted) {     // deleted record
                    var old_line = this.sale_line_by_id[new_line['id']];
                    if (old_line) {
                        delete this.sale_line_by_id[old_line['id']];
                        var sale = this.sale_order_by_id[old_line['order_id'][0]];
                        if (sale) {
                            var lines = _.filter(sale.lines, function (line) {
                                return line['id'] != old_line['id']
                            });
                            sale.lines = lines;
                        }
                    }
                } else {                     // deleted record
                    var old_line = this.sale_line_by_id[new_line['id']];
                    this.sale_line_by_id[new_line['id']] = new_line;
                    if (old_line) {          // old line save before
                        var sale = this.sale_order_by_id[old_line['order_id'][0]];
                        if (sale) {
                            var lines = _.filter(sale.lines, function (line) {
                                return line['id'] != old_line['id']
                            });
                            lines.push(new_line)
                            sale.lines = lines;
                        }
                    } else {                 // push new items
                        var sale = this.sale_order_by_id[new_line['order_id'][0]];
                        if (sale) {
                            sale.lines.push(new_line)
                        }
                    }
                }
            }
        },
        _insurance_search_string: function (insurance) {
            var str = insurance.insurance_company_id[1];
            str += '|' + insurance.code;
            if (insurance.subscriber_id) {
                var partner = this.partner_by_id[insurance.subscriber_id[0]]
                if (partner) {
                    if (partner['name']) {
                        str += '|' + partner['name'];
                    }
                    if (partner.mobile) {
                        str += '|' + partner['mobile'];
                    }
                    if (partner.phone) {
                        str += '|' + partner['phone'];
                    }
                    if (partner.email) {
                        str += '|' + partner['email'];
                    }
                }
            }
            if (insurance.patient_name) {
                str += '|' + insurance['patient_name'];
            }
            if (insurance.patient_number) {
                str += '|' + insurance['patient_number'];
            }
            if (insurance.medical_number) {
                str += '|' + insurance['medical_number'];
            }
            if (insurance.employee) {
                str += '|' + insurance['employee'];
            }
            if (insurance.phone) {
                str += '|' + insurance['phone'];
            }
            str = '' + insurance['id'] + ':' + str.replace(':', '') + '\n';
            return str;
        },
        search_insurances: function (query) {
            try {
                query = query.replace(/[\[\]\(\)\+\*\?\.\-\!\&\^\$\|\~\_\{\}\:\,\\\/]/g, '.');
                query = query.replace(' ', '.+');
                var re = RegExp("([0-9]+):.*?" + query, "gi");
            } catch (e) {
                return [];
            }
            var results = [];
            for (var i = 0; i < this.limit; i++) {
                var r = re.exec(this.insurances_search_string);
                if (r && r[1]) {
                    var id = r[1];
                    if (this.insurance_by_id[id] !== undefined) {
                        results.push(this.insurance_by_id[id]);
                    }
                } else {
                    break;
                }
            }
            return results;
        },
        save_insurances: function (insurances) {
            if (this.insurances.length == 0) {
                this.insurances = insurances;
            } else {
                this.insurances = this.insurances.concat(insurances);
            }
            for (var i = 0; i < this.insurances.length; i++) {
                var insurance = this.insurances[i];
                this.insurance_by_id[insurance.id] = insurance;
                this.insurance_by_partner_id[insurance.subscriber_id[0]] = insurance
                var str = this._insurance_search_string(insurance);
                this.insurances_autocomplete.push({
                    value: insurance['id'],
                    label: str
                });
                this.insurances_search_string += str;
            }
        },
    });
});
