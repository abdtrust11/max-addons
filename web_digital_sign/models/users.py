# See LICENSE file for full copyright and licensing details.

from odoo import models, fields

class sale_order(models.Model):
    _inherit = "sale.order"

    signatures = fields.Binary('Signature')


class Users(models.Model):
    _inherit = 'res.users'

    digital_signature = fields.Binary(string='Signature')
