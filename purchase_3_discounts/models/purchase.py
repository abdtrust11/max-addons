# -*- coding: utf-8 -*-
# Copyright 2017 Ignacio Ibeas <ignacio@acysos.com>
# Copyright 2012 Ignacio Ibeas <ignacio@acysos.com>
# Copyright 2011 Nan Projectes de Programari Lliure S.L.
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
from odoo import models, fields, api, _


# class PurchaseOrder(models.Model):
#     _inherit = "purchase.order"
#
#     @api.model
#     def _prepare_inv_line(self, account_id, order_line):
#         result = super(PurchaseOrder, self)._prepare_inv_line(
#             account_id, order_line)
#         discount1 = order_line.discount1 or 0.0
#         discount2 = order_line.discount2 or 0.0
#         discount3 = order_line.discount3 or 0.0
#         result['discount1'] = discount1
#         result['discount2'] = discount2
#         result['discount3'] = discount3
#         result['discount'] = 100 * (1 - ((100 - discount1) / 100.00 * (
#             100 - discount2) / 100.00 * (100 - discount3) / 100.00))
#         return result




class PurchaseOrderLine(models.Model):
    _inherit = "purchase.order.line"



    discount = fields.Float(string='Calculated discount', digits=(10, 2),
                            readonly="True")
    discount1 = fields.Float(string='cost 1', digits=(10, 2))
    discount2 = fields.Float(string='cost 2', digits=(10, 2))
    discount3 = fields.Float(string='cost 3', digits=(10, 2))
    amount_vendor = fields.Float(string='Amount Vendor', digits=(10, 2) , readonly="True" ,copy=False, store=True)


    @api.onchange('price_unit', 'product_qty')
    def _calculate_amount_vendor(self):
        self.amount_vendor =  self.price_unit * self.product_qty



    @api.onchange('discount1', 'discount2', 'discount3')
    def _calculate_discount(self):
        self.discount =  self.discount1 + self.discount2 + self.discount3

    @api.multi
    def write(self, vals):
        for line in self:
            if 'discount1' in vals:
                discount1 = vals['discount1']
            else:
                discount1 = line.discount1
            if 'discount2' in vals:
                discount2 = vals['discount2']
            else:
                discount2 = line.discount2
            if 'discount3' in vals:
                discount3 = vals['discount3']
            else:
                discount3 = line.discount3
            value =  discount1 + discount2 + discount3
            vals['discount'] = value
            res = super(PurchaseOrderLine, self).write(vals)

    @api.model
    def create(self, vals):
        if 'discount1' in vals:
            discount1 = vals['discount1']
        else:
            discount1 = 0
        if 'discount2' in vals:
            discount2 = vals['discount2']
        else:
            discount2 = 0
        if 'discount3' in vals:
            discount3 = vals['discount3']
        else:
            discount3 = 0
        vals['discount'] = discount1 + discount2 + discount3
        res = super(PurchaseOrderLine, self).create(vals)
        return res
